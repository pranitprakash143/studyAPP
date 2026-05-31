import chromadb
client = chromadb.HttpClient(host="localhost", port=8001)
try:
    collection = client.get_or_create_collection("prepagent-docs")
    res = collection.get(include=["metadatas"])
    print("SUCCESS:", len(res['metadatas']))
except Exception as e:
    print("ERROR:", str(e))
