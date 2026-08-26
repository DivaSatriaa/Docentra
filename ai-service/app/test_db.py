from app.db import get_connection


with get_connection() as connection:
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_database(), current_user;")
        database, user = cursor.fetchone()

        print("Database:", database)
        print("User:", user)
