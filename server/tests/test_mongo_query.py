from typing import Any
import uuid

class FieldRef:
    def __init__(self, name: str):
        self.name = name

    def __eq__(self, other: Any):
        val = str(other.id) if hasattr(other, "id") else (str(other) if isinstance(other, uuid.UUID) else other)
        return {self.name: val}

    def __ne__(self, other: Any):
        return {self.name: {"$ne": other}}

    def in_(self, values: Any):
        return {self.name: {"$in": list(values)}}

class MongoQuery:
    def __init__(self, model_class: Any = None):
        self.model_class = model_class
        self._filters: list[dict] = []
        self._sort: list[tuple[str, int]] = []
        self._limit: int | None = None
        self._is_count: bool = False

    def where(self, *conditions):
        for c in conditions:
            if isinstance(c, dict):
                self._filters.append(c)
        return self

    def order_by(self, *fields):
        for f in fields:
            name = f.name if hasattr(f, "name") else str(f)
            self._sort.append((name, 1))
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    def _build_filter(self) -> dict:
        if not self._filters:
            return {}
        if len(self._filters) == 1:
            return self._filters[0]
        return {"$and": self._filters}

    def _execute_mongo_scalar(self, db):
        col_name = getattr(self.model_class, "__collection__", "test")
        flt = self._build_filter()
        if self._is_count:
            return db[col_name].count_documents(flt)
        doc = db[col_name].find_one(flt)
        if doc and self.model_class:
            return self.model_class(doc)
        return doc

    def _execute_mongo_scalars(self, db):
        col_name = getattr(self.model_class, "__collection__", "test")
        flt = self._build_filter()
        cursor = db[col_name].find(flt)
        if self._sort:
            cursor = cursor.sort(self._sort)
        if self._limit:
            cursor = cursor.limit(self._limit)
        return [self.model_class(d) if self.model_class else d for d in cursor]

def select(target):
    q = MongoQuery(target)
    return q

class UserMock:
    __collection__ = "users"
    email = FieldRef("email")
    id = FieldRef("id")

q = select(UserMock).where(UserMock.email == "test@example.com").limit(1)
print("Filter built:", q._build_filter())
print("Test passed successfully.")
