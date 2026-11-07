import uuid
from app.db.mongodb import get_mongo_db, seed_test_credentials
from app.database import SessionLocal, get_db
from app.models import User, Company, BrandBrain, BrandRule, Analysis, AnalysisJob, AuthSession, select, func
from app.utils.security import verify_password, hash_api_key, new_session_token

def test_full_mongo_pipeline():
    db = SessionLocal()
    seed_test_credentials(db.db)
    
    # 1. Test user lookup
    user = db.scalar(select(User).where(User.email == "imail@shubhamos.com"))
    assert user is not None, "Test user not found!"
    assert verify_password("RCL9JLVL", user.password_hash), "Password verification failed!"
    print(f"Verified test user: {user.name} ({user.email})")

    # 2. Test session creation
    token = new_session_token()
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_api_key(token),
        expires_at=user.created_at,
    )
    db.add(session)
    db.commit()
    
    found_sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_api_key(token)))
    assert found_sess is not None
    print("Verified session creation and lookup")
    db.delete(found_sess)
    db.commit()

    # 3. Test company count query
    count = db.scalar(select(func.count()).select_from(Company).where(Company.owner_user_id == user.id))
    print(f"Company count for test user: {count}")

    print("ALL MONGO TESTS PASSED!")

if __name__ == "__main__":
    test_full_mongo_pipeline()
