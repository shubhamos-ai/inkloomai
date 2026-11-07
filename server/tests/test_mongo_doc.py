import uuid
from datetime import datetime, UTC
import pymongo

client = pymongo.MongoClient("mongodb://127.0.0.1:27017/")
db = client["inkloom_test"]

class Doc(dict):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "_id" not in self and "id" in self:
            self["_id"] = str(self["id"])
        elif "_id" in self and "id" not in self:
            self["id"] = str(self["_id"])

    def __getattr__(self, name):
        if name in self:
            return self[name]
        return None

    def __setattr__(self, name, value):
        self[name] = value

u = Doc(id=str(uuid.uuid4()), name="Test User", email="test@example.com")
db.users.replace_one({"_id": u.id}, u, upsert=True)

found = db.users.find_one({"email": "test@example.com"})
wrapped = Doc(found)
print("Found user:", wrapped.name, wrapped.email, wrapped.id)
db.users.delete_many({})
print("Test completed successfully.")
