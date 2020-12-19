import * as sockjs from "sockjs";
import * as net from "net";
import * as http from "http";
import * as fs from "fs";

// Re-export sockjs definitions:
export type Connection = sockjs.Connection;
export type ServerOptions = sockjs.ServerOptions;
export type Server = sockjs.Server;
type CreateServer = (options?: ServerOptions | undefined) => Server;

const UNIX = true;
const UNIX_PATH = "/tmp/poke-env-ipc.sock";

class UnixServer extends net.Server implements Server {
    constructor(_options?: ServerOptions) {
        super();
    }

    /**
     * Start the Unix IPC server.
     *
     * Instead of installing an handler on a http server as one would do with websockets,
     * we create a brand new Unix server.
     */
    installHandlers(_server: http.Server, _options?: ServerOptions) {
        // Clean previous socket, is any
        if (fs.existsSync(UNIX_PATH)) {
            fs.unlinkSync(UNIX_PATH);
        }
        this.listen(UNIX_PATH, () => {
            console.log(`Listening on: ${UNIX_PATH}`);
        })
    }

    on(event: string, callback: (args: any) => any): this {
        console.log(`Event: ${event} - ${callback}`);
        switch (event) {
            case 'connection':
                this.on_connection(callback);
                break;
            case 'listening':
                this.on_listening(callback);
                break;
        }
        return this;
    }

    on_connection(listener: (conn: Connection) => any) {
        super.on('connection', socket => {
            console.log(`Unix connection`);
            socket.setEncoding("utf8");
            const conn = socketToConn(socket);
            listener(conn);
        });
    }

    on_listening(callback: (error: any) => any) {
        super.on('listening', callback);
    }
}

/** A net.Socket wrapper, whose purpose is to act like a SockJS Connection. */
class UnixConn extends net.Socket {
    constructor(socket: net.Socket) {
        super();
        Object.assign(this, socket);
        Object.defineProperty(this, "remoteAddress", {value: "127.0.0.1"});
    }

    close(_code?: string, _reason?: string) {
        this.end();
        console.log("Closed Unix conn");
        return true;
    }
}

/**
 * An helper method to disguise a net.Socket into a SockJS connection.
 *
 * This method is not 100% type safe, is assign all the method and properties of the socket
 * to a connection object, there is a lot of overlap between net.Socket and SockJS Connection,
 * but there might be a few missing method or attribute.
 * In case the code break in the future because of a missing attribute/method, just add it to
 * `conn`.
 */
const socketToConn = (socket: net.Socket) => {
    const conn = new UnixConn(socket);
    //@ts-expect-error: The convertion is not type-safe, only a subset of attributes are present.
    return conn as Connection;
}

const createUnixServer: CreateServer = (options?: ServerOptions) => {
    const server = new UnixServer(options);
    return server;
}

// Depending on the IPC medium, export either a sockjs or unix based server.
export const createServer: CreateServer = UNIX ? createUnixServer : sockjs.createServer;

