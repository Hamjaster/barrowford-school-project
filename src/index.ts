const express = require("express");
type Request = import("express").Request;
type Response = import("express").Response;

const app = express();
const port = 3000;

app.get("/", (req: Request, res: Response) => {
    res.send("Hello from Express + TypeScript!");
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
