import os

import psycopg
from dotenv import load_dotenv
from pgvector.psycopg import register_vector


load_dotenv()


def get_connection():
    connection = psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "docentra"),
        password=os.getenv("DB_PASSWORD", ""),
        dbname=os.getenv("DB_NAME", "docentra"),
    )

    register_vector(connection)

    return connection
