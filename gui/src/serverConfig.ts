// Single source of truth for the Python server's address, matching
// core/server/__main__.py's default --host/--port.
//
// Python 伺服器位址的唯一來源，對應 core/server/__main__.py 的預設
// --host/--port。

const SERVER_HOST = '127.0.0.1:8765'

export const WS_URL = `ws://${SERVER_HOST}/ws`
export const HTTP_ORIGIN = `http://${SERVER_HOST}`
