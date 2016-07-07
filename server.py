from bottle import route, run, request, response

@route('/', method="POST")
def store():
    content = request.body.read()
    with open("toread.txt", "ab") as f:
        f.write(content)
        f.write(b'\n')

    response.set_header("Access-Control-Allow-Origin", "*")
    response.set_header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    return

run(host='localhost', port=8080, reloader=True)
