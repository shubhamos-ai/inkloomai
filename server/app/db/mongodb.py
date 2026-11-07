"""MongoDB connection manager, collections, indexing, and persistent session support."""
from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any, Type, TypeVar

import pymongo
from pymongo import MongoClient
from pymongo.database import Database

from app.config import settings

logger = logging.getLogger("inkloom.mongodb")

_client: MongoClient | None = None
_db: Database | None = None


def utcnow() -> datetime:
    """Naive-UTC timestamp helper."""
    return datetime.now(UTC).replace(tzinfo=None)


def get_mongo_client() -> MongoClient:
    global _client
    if _client is None:
        url = settings.DATABASE_URL
        if not url.startswith("mongodb"):
            url = "mongodb://127.0.0.1:27017/inkloom"
        _client = MongoClient(url, serverSelectionTimeoutMS=5000, connect=True, uuidRepresentation="standard")
    return _client


def get_mongo_db() -> Database:
    global _db
    if _db is None:
        client = get_mongo_client()
        # Parse db name from URL or use settings.MONGODB_DB_NAME
        db_name = settings.MONGODB_DB_NAME or "inkloom"
        if "/" in settings.DATABASE_URL:
            part = settings.DATABASE_URL.split("/")[-1].split("?")[0].strip()
            if part:
                db_name = part
        _db = client[db_name]
        init_db_indexes(_db)
    return _db


def init_db_indexes(db: Database) -> None:
    """Ensure all required indexes exist with proper constraints."""
    try:
        # Users
        try:
            db.users.drop_index("email_1")
        except Exception:
            pass
        db.users.create_index(
            "email",
            unique=True,
            partialFilterExpression={"email": {"$type": "string"}},
        )

        # Companies
        db.companies.create_index("owner_user_id")
        db.companies.create_index("api_key_hash", unique=True, sparse=True)

        # Auth sessions
        db.auth_sessions.create_index("token_hash", unique=True, sparse=True)
        db.auth_sessions.create_index("user_id")
        db.auth_sessions.create_index("expires_at")

        # Brand brains & rules
        db.brand_brains.create_index("company_id", unique=True, sparse=True)
        db.brand_rules.create_index("company_id")
        db.brand_rules.create_index("brain_id")
        db.brand_rules.create_index([("company_id", 1), ("code", 1)])

        # Analyses & jobs
        db.analyses.create_index("company_id")
        db.analyses.create_index("status")
        db.analyses.create_index("created_at")
        db.analysis_jobs.create_index("analysis_id", unique=True, sparse=True)
        db.analysis_jobs.create_index("company_id")
        db.analysis_jobs.create_index("status")

        # Seed test credentials required by the prompt
        seed_test_credentials(db)
    except Exception as e:
        logger.warning(f"Error initializing MongoDB indexes: {e}")


def seed_test_credentials(db: Database) -> None:
    """Seed the mandated test user (imail@shubhamos.com / RCL9JLVL) if not present."""
    from app.utils.security import hash_password

    test_email = "imail@shubhamos.com"
    existing = db.users.find_one({"email": test_email})
    pw_hash = hash_password("RCL9JLVL")
    if not existing:
        user_id = str(uuid.uuid4())
        user_doc = {
            "_id": user_id,
            "id": user_id,
            "name": "Shubham Admin",
            "email": test_email,
            "password_hash": pw_hash,
            "created_at": utcnow(),
            "updated_at": utcnow(),
        }
        db.users.insert_one(user_doc)
        logger.info(f"Seeded test user: {test_email}")
    else:
        db.users.update_one({"email": test_email}, {"$set": {"password_hash": pw_hash}})


def db_ready() -> bool:
    """Check connectivity to MongoDB."""
    try:
        client = get_mongo_client()
        client.admin.command("ping")
        return True
    except Exception:
        return False


T = TypeVar("T")


class MongoScalarResult:
    """Simulates SQLAlchemy scalars() result."""

    def __init__(self, items: list[Any]):
        self._items = items

    def all(self) -> list[Any]:
        return list(self._items)

    def first(self) -> Any | None:
        return self._items[0] if self._items else None


class MongoDBSession:
    """Compatibility session wrapping MongoDB so existing ORM queries function seamlessly."""

    def __init__(self, db: Database | None = None):
        self.db = db if db is not None else get_mongo_db()
        self._pending_add: list[Any] = []
        self._pending_delete: list[Any] = []
        self._identity_map: dict[tuple[Any, str], Any] = {}

    def _track(self, instance: Any) -> Any:
        if instance is None or not isinstance(instance, dict):
            return instance
        _id = str(instance.get("_id") or instance.get("id") or "")
        if _id:
            cls = type(instance)
            key = (cls, _id)
            if key in self._identity_map:
                return self._identity_map[key]
            self._identity_map[key] = instance
        return instance

    def add(self, instance: Any) -> None:
        if instance not in self._pending_add:
            self._pending_add.append(instance)
        self._track(instance)

    def delete(self, instance: Any) -> None:
        if instance not in self._pending_delete:
            self._pending_delete.append(instance)

    def commit(self) -> None:
        all_to_save = list(self._pending_add)
        for inst in list(self._identity_map.values()):
            if inst not in all_to_save and inst not in self._pending_delete:
                all_to_save.append(inst)
        for item in all_to_save:
            if hasattr(item, "_save_to_mongo"):
                item._save_to_mongo(self.db)
            elif isinstance(item, dict) and hasattr(item, "__collection__"):
                col = self.db[item.__collection__]
                _id = str(item.get("_id") or item.get("id"))
                item["_id"] = _id
                item["id"] = _id
                col.replace_one({"_id": _id}, dict(item), upsert=True)
        self._pending_add.clear()

        for item in self._pending_delete:
            if hasattr(item, "_delete_from_mongo"):
                item._delete_from_mongo(self.db)
            elif isinstance(item, dict) and hasattr(item, "__collection__"):
                col = self.db[item.__collection__]
                _id = str(item.get("_id") or item.get("id"))
                col.delete_one({"_id": _id})
        self._pending_delete.clear()

    def flush(self) -> None:
        self.commit()

    def query(self, *targets: Any) -> Any:
        from app.models.base import MongoQuery
        return MongoQuery(*targets, session=self)

    def rollback(self) -> None:
        self._pending_add.clear()
        self._pending_delete.clear()
        self._identity_map.clear()

    def refresh(self, instance: Any) -> None:
        if hasattr(instance, "_refresh_from_mongo"):
            instance._refresh_from_mongo(self.db)

    def get(self, model_class: Type[T], ident: Any) -> T | None:
        key = (model_class, str(ident))
        if key in self._identity_map:
            return self._identity_map[key]
        collection_name = getattr(model_class, "__collection__", getattr(model_class, "__tablename__", None))
        if collection_name:
            data = self.db[collection_name].find_one({"_id": str(ident)})
            if data:
                inst = model_class(data)
                self._identity_map[key] = inst
                return inst
        return None

    def scalar(self, query: Any) -> Any | None:
        if hasattr(query, "_execute_mongo_scalar"):
            res = query._execute_mongo_scalar(self.db)
            return self._track(res)
        return None

    def scalars(self, query: Any) -> MongoScalarResult:
        if hasattr(query, "_execute_mongo_scalars"):
            items = query._execute_mongo_scalars(self.db)
            tracked = [self._track(it) for it in items]
            return MongoScalarResult(tracked)
        return MongoScalarResult([])

    def execute(self, statement: Any) -> Any:
        if hasattr(statement, "_execute_mongo"):
            return statement._execute_mongo(self.db)
        from app.models.base import MongoExecuteResult
        return MongoExecuteResult([])

    def expire_all(self) -> None:
        self._identity_map.clear()

    def close(self) -> None:
        self._pending_add.clear()
        self._pending_delete.clear()

    def __enter__(self) -> MongoDBSession:
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
