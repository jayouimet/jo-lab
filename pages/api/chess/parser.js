import { Chess } from "chess.js";
import path from 'path';
import fs from "fs";
import readline from "readline";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).send({message: "Method not allowed"});
        return;
    }

    const dir = path.join(process.cwd(), 'resources');
    const stream = await fs.createReadStream(dir + '/pgn/test.pgn');

    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    let game = new Chess();;
    let str = "";

    for await (const line of rl) {
        if (line.startsWith('[')) {
            compileGame(game, str);
            str = ""
        } else {
            str += " " + line;
        }
    }

    console.log(str);

    const body = req.body;

    // const game = new Chess();
    game.load(body.fen);

    res.status(200).json({ fen: game.fen() });
}

function compileGame(game, str) {
    game.clear();

    let arr = str.split(/(\s*\d+[.]\s*|\s)/);
    // let arr = str.split(/(\s*\d+[.]\s*|\s)/);
    console.log(arr);

    // Pawn move 
    
}
