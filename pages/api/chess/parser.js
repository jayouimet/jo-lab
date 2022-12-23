import { Chess } from "chess.js";
import path from 'path';
import fs, { stat } from "fs";
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
    let str = "";

    for await (const line of rl) {
        if (line.startsWith('[')) {
            compileGame(str);
            str = ""
        } else {
            str += " " + line;
        }
    }
    compileGame(game, str);

    const body = req.body;

    // const game = new Chess();
    game.load(body.fen);

    res.status(200).json({ fen: game.fen() });
}

function compileGame(str) {
    let arr = str.split(/\s+/).filter((word) => !word.match(/\d+[.]/) && word.length > 0);
    // let arr = str.split(/\s+/).filter((word) => word.length > 0);
    if (arr.length == 0) {
        return;
    }

    let game = new Chess();

    let boardRes = {
        fen: '',
        w_wins: 0,
        b_wins: 0,
        w_wr: 1,
        b_wr: 0
    };

    const whiteWin = parseInt(arr.pop()[0]);
    const blackWin = parseInt(arr.pop()[2]);
    let fen = game.fen()
    let nextFen = undefined;

    let boardState = {
        fen: fen,
        w_wins: res.w_wins + whiteWin,
        b_wins: res.b_wins + blackWin,
        w_wr:  (res.w_wins + whiteWin) / (res.w_wins + whiteWin + res.b_wins + blackWin),
        b_wr: (res.b_wins + blackWin) / (res.w_wins + whiteWin + res.b_wins + blackWin)
    }

    let fens = [];
    fens.push(fen);

    states.push(state);

    while (arr.length > 0) {
        let word = arr.shift();

        let moveRes = {
            prev_fen: fen,
            move: word,
            next_fen: ''
        };

        game.move(word);
        
        nextFen = game.fen()

        let move = {
            prev_fen: fen,
            move: word,
            next_fen: nextFen
        };

        fen = nextFen;

        boardRes = {
            fen: '',
            w_wins: 0,
            b_wins: 0,
            w_wr: 1,
            b_wr: 0
        };

        boardState = {
            fen: fen,
            w_wins: res.w_wins + whiteWin,
            b_wins: res.b_wins + blackWin,
            w_wr:  (res.w_wins + whiteWin) / (res.w_wins + whiteWin + res.b_wins + blackWin),
            b_wr: (res.b_wins + blackWin) / (res.w_wins + whiteWin + res.b_wins + blackWin)
        };
        
        fens.push(fen);
    }

    // console.log(game.fen());

    // Pawn move 
    
}
