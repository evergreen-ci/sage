# Evergreen AI Service

This is a simple Go-based web server that responds to HTTP requests, handles
CORS headers, and loads secrets from a `.env` file.

## Getting Started

### Prerequisites

- Go 1.18 or newer (recommended: Go 1.24)
- Make

### Setup

1. **Clone the repository**
   ```sh
   git clone <your-repo-url>
   cd evergreen-ai-service
   ```

2. **Create a `.env` file**
   ```sh
   echo "SECRET=your_secret_value" > .env
   ```
   Replace `your_secret_value` with your actual secret.

3. **Initialize Go modules (if not already done)**
   ```sh
   go mod tidy
   ```

### Running the Server

Start the server using Make:

```sh
make run
```

The server will start on `http://localhost:8080`.

### Example Request

Send a GET request to the root endpoint:

```sh
curl http://localhost:8080/
```

You should see a response like:

```
Hello, World! Secret: your_secret_value
```

### Notes

- The `.env` file is ignored by git and should not be committed.
- CORS headers are set to allow all origins and GET/OPTIONS methods.

---

Feel free to modify and extend this project as needed!
