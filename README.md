# Elysia with Bun runtime

## Getting Started

To get started with this template, simply paste this command into your terminal:

```bash
bun create elysia ./elysia-example
```

## Development

To start the development server run:

```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

# Syncing with a Parent Server

Below are instructions on configuring the parent URL of the data server, stopping the server, and running the sync script.

## Prerequisites

Ensure you have the following installed on your system:

- [Bun](https://bun.sh/)
- [Prisma](https://www.prisma.io/)
- Systemd (for managing the service)

## Configuration

### Setting the Parent URL

1. Navigate to the `data-server-node` directory:

   ```bash
   cd ~/data-server-node
   ```

2. Open the `.env` file in a text editor:

   ```bash
   vim .env
   ```

3. Locate the `PARENT_NODE_URL` line. Uncomment it if it is commented out, and set the desired URL:

   ```env
   PARENT_NODE_URL="https://csiwiki.me.columbia.edu/rocketsdata2"
   ```

4. Save and close the file.

5. Restart the server to apply the changes:

   ```bash
   sudo systemctl restart data-server-node
   ```

6. Verify the server is using the correct parent URL by checking the logs:

   ```bash
   sudo journalctl -f -u data-server-node
   ```

   Look for a log entry like:

   ```
   📡 Using parent node at https://csiwiki.me.columbia.edu/rocketsdata2
   ```

## Stopping the Server

To stop the data server, execute the following command:

```bash
sudo systemctl stop data-server-node
```

## Running the Sync Script

1. Ensure the server is stopped as described above.

2. Run the sync worker script using Bun:

   ```bash
   bun run src/scripts/run-sync-worker.ts
   ```

   You should see output indicating the sync worker has started:

   ```
   📡 Using parent node at https://csiwiki.me.columbia.edu/rocketsdata2
   🔄 Started sync worker
   ⏳ Records are out of date
   ```

## Additional Scripts

- **Start Server**: To start the server, use:

```bash
sudo systemctl start data-server-node
```

- **Manual Upload Script**: If you need to run a manual upload script, ensure the server is stopped, then execute:

```bash
bun run src/scripts/delete-synced-records.ts
```

## Troubleshooting

- Ensure all dependencies are installed and up to date.
- Check logs for any errors or warnings using:

```bash
sudo journalctl -f -u data-server-node
```

- Verify your `.env` file is correctly configured with valid URLs and credentials.

## Running the Sync Command in a Screen Session

Using a screen session to run the sync command is beneficial when you want to ensure that the process continues to run independently of your terminal session. This is particularly useful for long-running tasks or when you need to disconnect from the server without interrupting the process.

### Installing Screen

If you don't have `screen` installed, you can install it using:

```bash
sudo apt-get update
sudo apt-get install screen
```

### Running the Sync Command in a Screen Session

1. Start a new screen session:

   ```bash
   screen -S sync-session
   ```

2. Run the sync worker script within the screen session using Bun:

   ```bash
   bun run src/scripts/run-sync-worker.ts
   ```

   You should see output similar to:

   ```
   📡 Using parent node at https://csiwiki.me.columbia.edu/rocketsdata2
   🔄 Started sync worker
   ⏳ Records are out of date
   ```

3. To detach from the screen session (leaving the process running), press:

   ```
   Ctrl + A, then D
   ```

4. You can list all the running screen sessions with:

   ```bash
   screen -ls
   ```

5. To reattach to the screen session, use:

   ```bash
   screen -r sync-session
   ```

### Benefits of Using Screen

- **Persistence**: Allows the sync process to continue running even if you disconnect from the server.
- **Convenience**: You can start a task, detach, and come back later to check on its progress.
- **Resource Management**: Frees up your terminal for other tasks while the sync operation continues in the background.

Using screen is a powerful way to manage long-running processes on remote servers, ensuring they remain unaffected by network disruptions or accidental terminal closures.
