# Web ssh tool

This tool is a web server that support normal web browser for ssh connect to server. It work as a ssh reverse proxy. It request to deploy on server. Client side has not need to install any tools but visit the website and access the server ssh. It is convenient for the device not ready with ssh tools but has browsers like pad or guest pc.

At the same time, it also provide file system service. You can preview/download server's file or upload file to server.

<img src="doc/login.png"/>

<img src="doc/interface.png"/>

# Get the software

Software is open source. To build the app (after clone the project):

```console
npm i
npm run build
```

The bin will appear in

```console
rust/target/release/rust
```

# Run the software

Just run the bin, or create a system service for bin.

IMPORTANT: make sure the bin has the right permission that can be executed by the user that you will login later.

Get run help

```console
<bin> --help
```

The software does't need any permission like root permission. It can run by any user. Software will get the right permissions after you correctly login with your username and password on the website (login root and act like root, login guest and act like guest).

# Software Runtime Structure

When bin run, generally run in master mode. Master mode just provide http server for web and reverse http proxy for loopback.

<img src="doc/structure.svg"/>

When user login, master server will help user to create a ssh connection on the server locally and use the ssh connection to create a new process (the same bin but run in client mode) in the target user space. Because the new process created by the target user and running in the target user space, it has the same permission as the target user.

Now all the operation send to master will be forwarded to the client server. The client server will do the real job for user under the right permission. And also the master server doesn't need any permission.

Both master and client handle request and response in stream, so the total memory usage will be controlled as low as possible.

<img src="doc/memory-usage.png"/>

# Develop this software

Request node and rust's build toolchain.

Backend is written in rust (tokio/hyper).<br/>
Frontend is written in react and built by vite.<br/>
