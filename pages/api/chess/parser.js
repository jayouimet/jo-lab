import { Chess } from "chess.js";
import path from 'path';
import fs, { stat } from "fs";
import readline from "readline";
import { createClient } from "@urql/core";
import fetch from "isomorphic-unfetch";

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
            const fens = compileGameFens(str);
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

const boardStatesFromFen = `
  query getBoardStatesFromFen(
    $fen: String!,
  ) {
    BoardStates (
      where: {
        fen: { _eq: $fen}
      }
    ) {
      id
      fen
      w_wins
      b_wins
      w_wr
      b_wr
    }
  }
`

async function fetchGameStates(fens) {
    const client = createClient({
        url: process.env.HASURA_GRAPHQL_ENDPOINT,
        requestPolicy: 'network-only',
        fetchOptions: {
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            // 'x-hasura-admin-secret': config.hasura.adminSecret,
          },
        },
        fetch,
    })

    const result = await client
      .query(boardStatesFromFen, {
        fens,
      })
      .toPromise()
}

function compileGameFens(str) {
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

    return fens;



    // console.log(game.fen());

    // Pawn move 
    
}
