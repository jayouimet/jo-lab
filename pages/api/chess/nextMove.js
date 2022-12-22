import { Chess } from "chess.js";

export default function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).send({message: "Method not allowed"});
        return;
    }

    const body = req.body;

    const game = new Chess();
    game.load(body.fen);

    res.status(200).json({ fen: game.fen() });
}
