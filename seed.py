"""Seed data for Hermes Panel.

This script initializes the database schema only.
No demo data is seeded — the panel starts empty.
Real data is populated via the API when agents connect.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from backend.database import init_db

def seed():
    """Initialize database tables without seeding demo data."""
    init_db()
    print("Database initialized (empty). Ready for real data.")

if __name__ == "__main__":
    seed()
