from database import Base, engine
from auth_models import User


def create_users_table():
    try:
        Base.metadata.create_all(
            bind=engine,
            tables=[User.__table__]
        )

        with engine.connect() as connection:
            result = connection.exec_driver_sql(
                "SELECT COUNT(*) FROM users"
            )

            user_count = result.scalar()

        print("Users table created successfully!")
        print(f"Registered users: {user_count}")

    except Exception as error:
        print("Error creating users table:")
        print(error)

    finally:
        engine.dispose()


if __name__ == "__main__":
    create_users_table()