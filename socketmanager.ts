import { io, Socket } from "socket.io-client";

export default class SocketManager {
  private socket: Socket;
  private static instance: SocketManager;

  private constructor() {
    this.socket = io("http://localhost:3000");
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public getSocket(): Socket {
    return this.socket;
  }

  public getId(): string | undefined {
    return this.socket.id;
  }

  public on(event: string, callback: (...args: any[]) => void) {
    this.socket.on(event, callback);
  }

  public emit(event: string, data?: any) {
    this.socket.emit(event, data);
  }

  public disconnect() {
    this.socket.disconnect();
  }
}
