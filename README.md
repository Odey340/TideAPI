# TideAPI

A FastAPI-based service for tide data lookup, user management, and logging, using PostgreSQL and SQLAlchemy.

## Features

- Tide data lookup via API
- User management with API keys and rate limiting
- PostgreSQL database integration

## Quick Start

1. **Clone the repo and enter the directory**
2. **Create and activate a virtual environment**
   ```
   python -m venv venv
   venv\Scripts\activate  # On Windows
   ```
3. **Install dependencies**
   ```
   pip install -r requirements.txt
   ```
4. **Set up your `.env` file** with your database and API keys.
5. **Run the server**
   ```
   uvicorn main:app --reload
   ```

## API Example

```
GET /tide/api/tide?location=lagos&apikey=your_api_key
```

---

**Note:** Requires PostgreSQL running and accessible as configured in `.env`.


im goated
