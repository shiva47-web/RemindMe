from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

import models

from database import Base, engine


def initialize_database():

    try:
        # CHECK DATABASE CONNECTION
        with engine.connect() as connection:

            result = connection.execute(
                text(
                    "SELECT current_database(), current_user"
                )
            )

            database_name, username = result.fetchone()

            print("PostgreSQL connection successful!")
            print("Database:", database_name)
            print("User:", username)

        # CREATE TABLES
        Base.metadata.create_all(bind=engine)

        print("\nRemindMe database tables created successfully!")

        print("\nCreated tables:")

        for table_name in Base.metadata.tables:
            print("-", table_name)

    except SQLAlchemyError as error:

        print("\nDatabase initialization failed:")
        print(error)

        raise SystemExit(1)

    finally:
        engine.dispose()


if __name__ == "__main__":
    initialize_database()