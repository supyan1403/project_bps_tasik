import psycopg2

password = "bpskabtasik"
# Session pooler port 5432
uri = f"postgresql://postgres.uxtmjfbndtjgzshuffcq:{password}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

try:
    con = psycopg2.connect(uri)
    cur = con.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    tables = [r[0] for r in cur.fetchall()]
    print("SUCCESS CONNECTED! Tables:", tables)
    con.close()
except Exception as e:
    print("ERROR:", e)
