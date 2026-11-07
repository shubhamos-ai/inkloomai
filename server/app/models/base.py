"""Shared model base for MongoDB: PK, FieldRef, Query builder, and status constants."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, TypeVar

from app.db.mongodb import get_mongo_db, utcnow

JOB_STATUSES = ("queued", "processing", "completed", "failed", "cancelled")
ANALYSIS_STATUSES = ("queued", "processing", "completed", "failed", "cancelled")
SEVERITIES = ("critical", "major", "minor", "info")
OVERALL_STATUSES = ("passed", "needs_revision", "critical_failure", "inconclusive", "failed")


def uuid_pk() -> uuid.UUID:
    return uuid.uuid4()


class MongoCondition(dict):
    """Enables logical OR / AND between filter dictionary expressions."""

    def __or__(self, other: Any) -> MongoCondition:
        return MongoCondition({"$or": [dict(self), dict(other)]})

    def __and__(self, other: Any) -> MongoCondition:
        return MongoCondition({"$and": [dict(self), dict(other)]})


class FieldRef:
    """Represents a MongoDB document field for expressive query construction and property access."""

    def __init__(self, name: str, is_uuid: bool = False):
        self.name = name
        self.is_uuid = is_uuid or name.endswith("_id") or name in ("id", "_id", "owner_user_id")

    def __get__(self, instance: Any, owner: Any) -> Any:
        if instance is None:
            return self
        try:
            val = dict.__getitem__(instance, self.name)
        except KeyError:
            val = None
        if val is None and self.name == "_id":
            val = dict.get(instance, "id")
        if val is not None and self.is_uuid:
            if isinstance(val, uuid.UUID):
                return val
            try:
                return uuid.UUID(str(val))
            except (ValueError, TypeError):
                return val
        return val

    def __set__(self, instance: Any, value: Any) -> None:
        if instance is not None:
            dict.__setitem__(instance, self.name, value)
            if self.name in ("id", "_id"):
                dict.__setitem__(instance, "id", value)
                dict.__setitem__(instance, "_id", value)

    def __repr__(self) -> str:
        return f"FieldRef({self.name})"

    def desc(self) -> tuple[str, int]:
        return (self.name, -1)

    def asc(self) -> tuple[str, int]:
        return (self.name, 1)

    def is_(self, other: Any) -> MongoCondition:
        if other is None:
            return MongoCondition({self.name: None})
        val = str(other.id) if hasattr(other, "id") else (str(other) if isinstance(other, uuid.UUID) else other)
        return MongoCondition({self.name: val})

    def __eq__(self, other: Any) -> MongoCondition:
        if other is None:
            return MongoCondition({self.name: None})
        val = str(other.id) if hasattr(other, "id") else (str(other) if isinstance(other, uuid.UUID) else other)
        return MongoCondition({self.name: val})

    def __ne__(self, other: Any) -> MongoCondition:
        val = str(other.id) if hasattr(other, "id") else (str(other) if isinstance(other, uuid.UUID) else other)
        return MongoCondition({self.name: {"$ne": val}})

    def __lt__(self, other: Any) -> MongoCondition:
        return MongoCondition({self.name: {"$lt": other}})

    def __gt__(self, other: Any) -> MongoCondition:
        return MongoCondition({self.name: {"$gt": other}})

    def __le__(self, other: Any) -> MongoCondition:
        return MongoCondition({self.name: {"$lte": other}})

    def __ge__(self, other: Any) -> MongoCondition:
        return MongoCondition({self.name: {"$gte": other}})

    def in_(self, values: Any) -> MongoCondition:
        normalized = [
            str(v.id) if hasattr(v, "id") else (str(v) if isinstance(v, uuid.UUID) else v)
            for v in values
        ]
        return MongoCondition({self.name: {"$in": normalized}})


class _ClassGetDescriptor:
    def __get__(self, instance: Any, owner: Any) -> Any:
        if instance is None:
            def _get_by_id(ident: Any, db: Any = None) -> Any | None:
                database = db if db is not None else get_mongo_db()
                data = database[owner.__collection__].find_one({"_id": str(ident)})
                return owner(data) if data else None

            return _get_by_id
        return lambda key, default=None: dict.get(instance, key, default)


class MongoDocument(dict):
    """Base class for all MongoDB-persisted entities with dict + attribute access."""

    __collection__ = "documents"

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        for k, v in list(cls.__dict__.items()):
            if isinstance(v, FieldRef):
                v._owner_class = cls

    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        if args and isinstance(args[0], dict):
            self.update(args[0])
        self.update(kwargs)
        _id = self.get("_id") or self.get("id") or str(uuid.uuid4())
        self["_id"] = str(_id)
        self["id"] = str(_id)

        now = utcnow()
        if "created_at" not in self:
            self["created_at"] = now
        if "updated_at" not in self:
            self["updated_at"] = now

    def __getattr__(self, name: str) -> Any:
        if name in self:
            return self[name]
        return None

    def __setattr__(self, name: str, value: Any) -> None:
        if name in ("_pending_add", "_pending_delete"):
            super().__setattr__(name, value)
            return
        if name in ("id", "_id"):
            val_str = str(value)
            self["_id"] = val_str
            self["id"] = val_str
        else:
            self[name] = value

    def _save_to_mongo(self, db: Any = None) -> None:
        database = db if db is not None else get_mongo_db()
        self["updated_at"] = utcnow()
        data = {}
        for k, v in self.items():
            if isinstance(v, uuid.UUID):
                data[k] = str(v)
            else:
                data[k] = v
        _id = str(data["_id"])
        database[self.__collection__].replace_one({"_id": _id}, data, upsert=True)

    def _delete_from_mongo(self, db: Any = None) -> None:
        database = db if db is not None else get_mongo_db()
        _id = str(self.get("_id") or self.get("id"))
        database[self.__collection__].delete_one({"_id": _id})

    def _refresh_from_mongo(self, db: Any = None) -> None:
        database = db if db is not None else get_mongo_db()
        _id = str(self.get("_id") or self.get("id"))
        doc = database[self.__collection__].find_one({"_id": _id})
        if doc:
            self.clear()
            self.update(doc)

    get = _ClassGetDescriptor()

    @classmethod
    def find_one(cls, filter_dict: dict, db: Any = None) -> Any | None:
        database = db if db is not None else get_mongo_db()
        data = database[cls.__collection__].find_one(filter_dict)
        return cls(data) if data else None

    @classmethod
    def find(cls, filter_dict: dict, db: Any = None) -> list[Any]:
        database = db if db is not None else get_mongo_db()
        cursor = database[cls.__collection__].find(filter_dict)
        return [cls(d) for d in cursor]


class MongoExecuteResult:
    """Result object mimicking SQLAlchemy execute()."""

    def __init__(self, items: list[Any], rowcount: int = 0):
        self._items = items
        self.rowcount = rowcount or len(items)

    def all(self) -> list[Any]:
        return list(self._items)

    def first(self) -> Any | None:
        return self._items[0] if self._items else None

    def one(self) -> Any:
        if not self._items:
            return (0, None)
        return self._items[0]


class MongoQuery:
    """SQLAlchemy-compatible query interface backed by MongoDB."""

    def __init__(self, *targets: Any, session: Any = None):
        self.targets = list(targets)
        self.target = targets[0] if targets else None
        self.session = session
        self._filters: list[dict] = []
        self._sort: list[tuple[str, int]] = []
        self._limit: int | None = None
        self._offset: int | None = None
        self._is_count: bool = False
        self._from_class: Any = None

    def select_from(self, model_class: Any) -> MongoQuery:
        self._from_class = model_class
        return self

    def where(self, *conditions: Any) -> MongoQuery:
        for c in conditions:
            if isinstance(c, dict):
                self._filters.append(c)
        return self

    def order_by(self, *fields: Any) -> MongoQuery:
        for f in fields:
            if isinstance(f, tuple) and len(f) == 2:
                self._sort.append(f)
            else:
                name = f.name if hasattr(f, "name") else str(f)
                self._sort.append((name, 1))
        return self

    def limit(self, n: int) -> MongoQuery:
        self._limit = n
        return self

    def filter_by(self, **kwargs: Any) -> MongoQuery:
        for k, v in kwargs.items():
            self._filters.append({k: str(v) if isinstance(v, uuid.UUID) else v})
        return self

    def filter(self, *conditions: Any) -> MongoQuery:
        return self.where(*conditions)

    def one(self) -> Any:
        col_name = self._get_collection_name()
        flt = self._build_filter()
        doc = get_mongo_db()[col_name].find_one(flt)
        if doc is None:
            raise Exception("No row found")
        model_class = self._get_model_class()
        inst = doc
        if model_class and isinstance(model_class, type) and issubclass(model_class, MongoDocument):
            inst = model_class(doc)
        if self.session and hasattr(self.session, "_track"):
            inst = self.session._track(inst)
        return inst

    def first(self) -> Any | None:
        col_name = self._get_collection_name()
        flt = self._build_filter()
        doc = get_mongo_db()[col_name].find_one(flt)
        if doc is None:
            return None
        model_class = self._get_model_class()
        inst = doc
        if model_class and isinstance(model_class, type) and issubclass(model_class, MongoDocument):
            inst = model_class(doc)
        if self.session and hasattr(self.session, "_track"):
            inst = self.session._track(inst)
        return inst

    def all(self) -> list[Any]:
        col_name = self._get_collection_name()
        flt = self._build_filter()
        cursor = get_mongo_db()[col_name].find(flt)
        if self._sort:
            cursor = cursor.sort(self._sort)
        if self._offset:
            cursor = cursor.skip(self._offset)
        if self._limit:
            cursor = cursor.limit(self._limit)
        model_class = self._get_model_class()
        items = []
        for doc in cursor:
            inst = doc
            if model_class and isinstance(model_class, type) and issubclass(model_class, MongoDocument):
                inst = model_class(doc)
            if self.session and hasattr(self.session, "_track"):
                inst = self.session._track(inst)
            items.append(inst)
        return items

    def offset(self, n: int) -> MongoQuery:
        self._offset = n
        return self

    def _get_collection_name(self) -> str:
        model = self._from_class or self.target
        if hasattr(model, "_owner_class"):
            model = model._owner_class
        return getattr(model, "__collection__", getattr(model, "__tablename__", "documents"))

    def _get_model_class(self) -> Any:
        model = self._from_class or self.target
        if hasattr(model, "_owner_class"):
            model = model._owner_class
        return model

    def _build_filter(self) -> dict:
        if not self._filters:
            return {}
        if len(self._filters) == 1:
            return self._filters[0]
        return {"$and": self._filters}

    def _execute_mongo_scalar(self, db: Any) -> Any | None:
        col_name = self._get_collection_name()
        flt = self._build_filter()
        if self._is_count or getattr(self.target, "_is_func_count", False):
            return db[col_name].count_documents(flt)

        doc = db[col_name].find_one(flt)
        if doc is None:
            return None

        # If querying a specific attribute like AnalysisJob.id
        if isinstance(self.target, FieldRef):
            return doc.get(self.target.name) or doc.get("_id")

        model_class = self._get_model_class()
        if isinstance(model_class, type) and issubclass(model_class, MongoDocument):
            return model_class(doc)
        if callable(model_class):
            return model_class(doc)
        return doc

    def _execute_mongo_scalars(self, db: Any) -> list[Any]:
        col_name = self._get_collection_name()
        flt = self._build_filter()
        cursor = db[col_name].find(flt)
        if self._sort:
            cursor = cursor.sort(self._sort)
        if self._offset:
            cursor = cursor.skip(self._offset)
        if self._limit:
            cursor = cursor.limit(self._limit)

        model_class = self._get_model_class()
        results = []
        for d in cursor:
            if isinstance(self.target, FieldRef):
                results.append(d.get(self.target.name) or d.get("_id"))
            elif isinstance(model_class, type) and issubclass(model_class, MongoDocument):
                results.append(model_class(d))
            elif callable(model_class):
                results.append(model_class(d))
            else:
                results.append(d)
        return results

    def _execute_mongo(self, db: Any) -> MongoExecuteResult:
        col_name = self._get_collection_name()
        flt = self._build_filter()

        has_count = any(getattr(t, "_is_func_count", False) for t in self.targets)
        has_avg = any(getattr(t, "_is_func_avg", False) for t in self.targets)

        if has_count and has_avg:
            total_count = db[col_name].count_documents(flt)
            avg_target = next(t for t in self.targets if getattr(t, "_is_func_avg", False))
            field_name = avg_target.field.name if hasattr(avg_target.field, "name") else "compliance_score"
            pipeline = [
                {"$match": flt},
                {"$group": {"_id": None, "avg_val": {"$avg": f"${field_name}"}}},
            ]
            agg = list(db[col_name].aggregate(pipeline))
            avg_val = agg[0]["avg_val"] if agg else None
            return MongoExecuteResult([(total_count, avg_val)])

        if self._is_count or has_count:
            c = db[col_name].count_documents(flt)
            return MongoExecuteResult([c])

        scalars = self._execute_mongo_scalars(db)
        return MongoExecuteResult(scalars)


class MongoUpdateQuery:
    def __init__(self, model_class: Any):
        self.model_class = model_class
        self._filters: list[dict] = []
        self._values: dict[str, Any] = {}

    def where(self, *conditions: Any) -> MongoUpdateQuery:
        for c in conditions:
            if isinstance(c, dict):
                self._filters.append(c)
        return self

    def values(self, **kwargs: Any) -> MongoUpdateQuery:
        self._values.update(kwargs)
        return self

    def _execute_mongo(self, db: Any) -> MongoExecuteResult:
        col_name = getattr(self.model_class, "__collection__", getattr(self.model_class, "__tablename__", "documents"))
        flt = {}
        if len(self._filters) == 1:
            flt = self._filters[0]
        elif len(self._filters) > 1:
            flt = {"$and": self._filters}
        res = db[col_name].update_many(flt, {"$set": self._values})
        return MongoExecuteResult([], rowcount=res.modified_count)


def select(*targets: Any) -> MongoQuery:
    q = MongoQuery(*targets)
    if targets and getattr(targets[0], "_is_func_count", False):
        q._is_count = True
    return q


def update(model_class: Any) -> MongoUpdateQuery:
    return MongoUpdateQuery(model_class)


class _FuncCount:
    _is_func_count = True


class _FuncAvg:
    _is_func_avg = True

    def __init__(self, field: Any = None):
        self.field = field


class _FuncWrapper:
    @staticmethod
    def count(*args: Any) -> _FuncCount:
        return _FuncCount()

    @staticmethod
    def avg(field: Any = None) -> _FuncAvg:
        return _FuncAvg(field)


func = _FuncWrapper()


class TimestampMixin:
    pass


class Base(MongoDocument):
    pass
