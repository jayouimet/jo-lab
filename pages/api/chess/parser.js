import { Chess } from "chess.js";
import path from 'path';
import fs from "fs";
import readline from "readline";
import { createClient } from "@urql/core";
import fetch from "isomorphic-unfetch";
import { StatusCodes } from "http-status-codes";
import fenToState from "../../../util/api/fenToState";

const client = createClient({
    url: process.env.HASURA_GRAPHQL_ENDPOINT,
    requestPolicy: 'network-only',
    fetchOptions: {
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
        },
    },
    fetch,
})

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).send({ message: "Method not allowed" });
        return;
    }

    const dir = path.join(process.cwd(), 'resources');
    const stream = await fs.createReadStream(dir + '/pgn/test2.pgn');

    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    let str = "";

    let gamesImported = 0;

    let statesBatch = new Map();
    let movesBatch = new Map();

    for await (const line of rl) {
        if (line.startsWith('[')) {

            const { fens, result } = compileGameFens(str);

            if (fens?.length > 0) {
                const fenMoves = fens.reduce((results, f, i, farr) => {
                    // arr.length == 1 i = 0 false
                    // arr.length == 2 i = 0 true i = 1 false
                    // arr.length == 3 i = 0 true i = 1 true i = 2 false
                    if (farr.length - 1 > i) {
                        results.push(f + " " + farr[i + 1])
                    }
                    return results;
                }, [])

                let states;
                try {
                    states = await fetchGameStates(fens);
                } catch (err) {
                    const resJson = {
                        message: 'errorFensQuery',
                        extensions: {
                            code: StatusCodes.BAD_REQUEST,
                            name: 'errorFensQuery',
                        },
                    }
                    let response = res.status(StatusCodes.BAD_REQUEST).json(resJson);
                    console.error({
                        message: 'Error while querying BoardStates by fens.',
                        error: err,
                        requestBody: JSON.stringify(req.body),
                        response: {
                            statusCode: StatusCodes.BAD_REQUEST,
                            statusMessage: 'errorFensQuery',
                            json: JSON.stringify(resJson),
                        },
                    })
                    return response;
                }

                let moves;
                try {
                    moves = await fetchGameMoves(fenMoves);
                } catch (err) {
                    const resJson = {
                        message: 'errorMovesQuery',
                        extensions: {
                            code: StatusCodes.BAD_REQUEST,
                            name: 'errorMovesQuery',
                        },
                    }
                    let response = res.status(StatusCodes.BAD_REQUEST).json(resJson);
                    console.error({
                        message: 'Error while querying Moves by fen combinations.',
                        error: err,
                        requestBody: JSON.stringify(req.body),
                        response: {
                            statusCode: StatusCodes.BAD_REQUEST,
                            statusMessage: 'errorMovesQuery',
                            json: JSON.stringify(resJson),
                        },
                    })
                    return response;
                }

                let statesMap = new Map();
                for (const state of states) {
                    statesMap.set(state.fen, state);
                }

                let movesMap = new Map();
                for (const move of moves) {
                    movesMap.set(move.fen_next_fen_str, move);
                }

                let statesToUpsert = new Map();
                let movesToUpsert = new Map();

                for (let i = 0; i < fens.length; i++) {
                    let s;
                    if (statesBatch.has(fens[i])) {
                        s = statesBatch.get(fens[i]);
                    } else {
                        s = safeGetBoardState(fens[i], statesMap);
                    }
                    s.w_wins += result.w_win;
                    s.b_wins += result.b_win;
                    s.draws += result.draw;
                    const totalGames = s.w_wins + s.b_wins + s.draws;
                    s.w_wr = s.w_wins / totalGames;
                    s.b_wr = s.b_wins / totalGames;
                    s.draws_rate = s.draws / totalGames;
                    statesBatch.set(s.fen, s);
                    if (i == fens.length - 1) {
                        break;
                    }
                    let m;
                    if (movesBatch.has(fens[i] + " " + fens[i + 1])) {
                        m = movesBatch.get(fens[i] + " " + fens[i + 1]);
                    } else {
                        m = safeGetMoves(fens[i], fens[i + 1], movesMap);
                    }
                    m.times_played += 1;
                    movesBatch.set(m.fen_next_fen_str, m);
                }

                /*for (const [fen, state] of statesToUpsert.entries()) {
                    let s
                    if (statesBatch.has(fen)) {
                        s = statesBatch.get(fen);
                        s.w_wins += state.w_wins;
                        s.b_wins += state.b_wins;
                        s.draws += state.draws;
                        const totalGames = s.w_wins + s.b_wins + s.draws;
                        s.w_wr = s.w_wins / totalGames;
                        s.b_wr = s.b_wins / totalGames;
                        s.draws_rate = s.draws / totalGames;
                    } else {
                        s = state;
                    }
                    statesBatch.set(fen, s);
                }

                for (const [fen_next_fen_str, move] of movesToUpsert.entries()) {
                    let m
                    if (movesBatch.has(fen_next_fen_str)) {
                        m = movesBatch.get(fen_next_fen_str);
                        m.times_played += move.times_played;
                    } else {
                        m = move;
                    }
                    movesBatch.set(fen_next_fen_str, m);
                }*/

                gamesImported++;

                if (gamesImported % 1000 == 0) {
                    try {
                        const statesUpserted = await upsertBoardStates([ ...statesBatch.values()]);
                        if (statesUpserted)
                            await upsertMoves(Array.from(movesBatch.values()));
                    } catch (err) {
                        const resJson = {
                            message: err.statusCode,
                            extensions: {
                                code: StatusCodes.BAD_REQUEST,
                                name: err.statusCode,
                            },
                        }
                        let response = res.status(StatusCodes.BAD_REQUEST).json(resJson);
                        console.error({
                            message: err.error,
                            error: err,
                            requestBody: JSON.stringify(req.body),
                            response: {
                                statusCode: StatusCodes.BAD_REQUEST,
                                statusMessage: err.statusCode,
                                json: JSON.stringify(resJson),
                            },
                        })
                        return response;
                    }

                    statesBatch = new Map();
                    movesBatch = new Map();

                    console.log(`Games imported: ${gamesImported}`);
                }
            }

            str = ""
        } else {
            str += " " + line;
        }
    }

    const { fens, result } = compileGameFens(str);

    if (fens?.length > 0) {
        let states;
        const fenMoves = fens.reduce((results, f, i, farr) => {
            // arr.length == 1 i = 0 false
            // arr.length == 2 i = 0 true i = 1 false
            // arr.length == 3 i = 0 true i = 1 true i = 2 false
            if (farr.length - 1 > i) {
                results.push(f + " " + farr[i + 1])
            }
            return results;
        }, [])

        try {
            states = await fetchGameStates(fens);
        } catch (err) {
            const resJson = {
                message: 'errorFensQuery',
                extensions: {
                    code: StatusCodes.BAD_REQUEST,
                    name: 'errorFensQuery',
                },
            }
            let response = res.status(StatusCodes.BAD_REQUEST).json(resJson);
            console.error({
                message: 'Error while querying BoardStates by fens.',
                error: err,
                requestBody: JSON.stringify(req.body),
                response: {
                    statusCode: StatusCodes.BAD_REQUEST,
                    statusMessage: 'errorFensQuery',
                    json: JSON.stringify(resJson),
                },
            })
            return response;
        }

        let moves;
        try {
            moves = await fetchGameMoves(fenMoves);
        } catch (err) {
            const resJson = {
                message: 'errorMovesQuery',
                extensions: {
                    code: StatusCodes.BAD_REQUEST,
                    name: 'errorMovesQuery',
                },
            }
            let response = res.status(StatusCodes.BAD_REQUEST).json(resJson);
            console.error({
                message: 'Error while querying Moves by fen combinations.',
                error: err,
                requestBody: JSON.stringify(req.body),
                response: {
                    statusCode: StatusCodes.BAD_REQUEST,
                    statusMessage: 'errorMovesQuery',
                    json: JSON.stringify(resJson),
                },
            })
            return response;
        }

        let statesMap = new Map();
        for (const state of states) {
            statesMap.set(state.fen, state);
        }

        let movesMap = new Map();
        for (const move of moves) {
            movesMap.set(move.fen_next_fen_str, move);
        }

        let statesToUpsert = new Map();
        let movesToUpsert = new Map();

        for (let i = 0; i < fens.length; i++) {
            let s;
            if (statesBatch.has(fens[i])) {
                s = statesBatch.get(fens[i]);
            } else {
                s = safeGetBoardState(fens[i], statesMap);
            }
            s.w_wins += result.w_win;
            s.b_wins += result.b_win;
            s.draws += result.draw;
            const totalGames = s.w_wins + s.b_wins + s.draws;
            s.w_wr = s.w_wins / totalGames;
            s.b_wr = s.b_wins / totalGames;
            s.draws_rate = s.draws / totalGames;
            statesBatch.set(s.fen, s);
            if (i == fens.length - 1) {
                break;
            }
            let m;
            if (movesBatch.has(fens[i] + " " + fens[i + 1])) {
                m = movesBatch.get(fens[i] + " " + fens[i + 1]);
            } else {
                m = safeGetMoves(fens[i], fens[i + 1], movesMap);
            }
            m.times_played += 1;
            movesBatch.set(m.fen_next_fen_str, m);
        }

        /*for (const [fen, state] of statesToUpsert.entries()) {
            let s
            if (statesBatch.has(fen)) {
                s = statesBatch.get(fen);
                s.w_wins += state.w_wins;
                s.b_wins += state.b_wins;
                s.draws += state.draws;
                const totalGames = s.w_wins + s.b_wins + s.draws;
                s.w_wr = s.w_wins / totalGames;
                s.b_wr = s.b_wins / totalGames;
                s.draws_rate = s.draws / totalGames;
            } else {
                s = state;
            }
            statesBatch.set(fen, s);
        }

        for (const [fen_next_fen_str, move] of movesToUpsert.entries()) {
            let m
            if (movesBatch.has(fen_next_fen_str)) {
                m = movesBatch.get(fen_next_fen_str);
                m.times_played += move.times_played;
            } else {
                m = move;
            }
            movesBatch.set(fen_next_fen_str, m);
        }*/

        gamesImported++;

        try {
            const statesUpserted = await upsertBoardStates([ ...statesBatch.values()]);
            if (statesUpserted)
                await upsertMoves(Array.from(movesBatch.values()));
        } catch (err) {
            const resJson = {
                message: err.statusCode,
                extensions: {
                    code: StatusCodes.BAD_REQUEST,
                    name: err.statusCode,
                },
            }
            let response = res.status(StatusCodes.BAD_REQUEST).json(resJson);
            console.error({
                message: err.error,
                error: err,
                requestBody: JSON.stringify(req.body),
                response: {
                    statusCode: StatusCodes.BAD_REQUEST,
                    statusMessage: err.statusCode,
                    json: JSON.stringify(resJson),
                },
            })
            return response;
        }

        statesBatch = new Map();
        movesBatch = new Map();

        console.log(`Games imported: ${gamesImported}`);
        console.log("Done!");
    }

    const body = req.body;

    const game = new Chess();
    game.load(body.fen);

    res.status(200).json({ fen: game.fen() });
}

async function upsertBoardStates(statesToUpsert) {
    if (statesToUpsert.length == 0)
        return;
    let query = 'INSERT INTO "BoardStates" (fen, w_wins, b_wins, w_wr, b_wr, draws, draws_rate) VALUES ';
    for (let i = 0; i < statesToUpsert.length; i++) {
        let str = "('" + statesToUpsert[i].fen + "', " + statesToUpsert[i].w_wins + ", " + statesToUpsert[i].b_wins + ", " + statesToUpsert[i].w_wr + ", " + statesToUpsert[i].b_wr + ", " + statesToUpsert[i].draws + ", " + statesToUpsert[i].draws_rate;
        if (i == statesToUpsert.length - 1) {
            str += ") ";
        } else {
            str += "), ";
        }
        query += str;
    }
    query += "ON CONFLICT (fen) DO UPDATE SET w_wins = EXCLUDED.w_wins, b_wins = EXCLUDED.b_wins, w_wr = EXCLUDED.w_wr, b_wr = EXCLUDED.b_wr, draws = EXCLUDED.draws, draws_rate = EXCLUDED.draws_rate;";

    const result = await fetch(process.env.HASURA_QUERY_ENDPOINT, {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'X-Hasura-Admin-Secret': process.env.HASURA_ADMIN_SECRET,
        },
        body: JSON.stringify({
            type: 'run_sql',
            args: {
                source: "dbChess",
                sql: query,
            },
        }),
    })
        .then((response) => {
            if (response.ok) return response.json()
            else
                throw new Error({
                    statusCode: 'UnexpectedErrorUpsertStates',
                    error:
                        'An unexpected error occured trying to upsert BoardStates.',
                })
        })
        .catch((error) => {
            console.log(query)
            
            console.error(
                'An unexpected error occured trying to upsert BoardStates.',
                {
                    error,
                },
            )

            throw new Error({
                statusCode: 'UnexpectedErrorUpsertStates',
                error: error,
            })
        })

    return result != undefined;
}

async function upsertMoves(movesToUpsert) {
    if (movesToUpsert.length == 0)
        return;
    let query = 'INSERT INTO "Moves" (fen, next_fen, times_played, fen_next_fen_str) VALUES ';
    for (let i = 0; i < movesToUpsert.length; i++) {
        let str = "('" + movesToUpsert[i].fen + "', '" + movesToUpsert[i].next_fen + "', " + movesToUpsert[i].times_played + ", '" + movesToUpsert[i].fen_next_fen_str;
        if (i == movesToUpsert.length - 1) {
            str += "') ";
        } else {
            str += "'), ";
        }
        query += str;
    }
    query += "ON CONFLICT (fen_next_fen_str) DO UPDATE SET times_played = EXCLUDED.times_played;";

    const result = await fetch(process.env.HASURA_QUERY_ENDPOINT, {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
        },
        body: JSON.stringify({
            type: 'run_sql',
            args: {
                source: "dbChess",
                sql: query,
            },
        }),
    })
        .then((response) => {
            if (response.ok) return response.json()
            else
                throw new Error({
                    statusCode: 'UnexpectedErrorUpsertMoves',
                    error:
                        'An unexpected error occured trying to upsert Moves.',
                })
        })
        .catch((error) => {
            console.log(query)

            console.error(
                'An unexpected error occured trying to upsert Moves.',
                {
                    error,
                },
            )

            throw new Error({
                statusCode: 'UnexpectedErrorUpsertMoves',
                error: error,
            })
        })

    return result != undefined;
}

function safeGetBoardState(fen, statesMap) {
    if (statesMap.has(fen)) {
        return statesMap.get(fen);
    }
    return {
        fen: fen,
        w_wins: 0,
        b_wins: 0,
        draws: 0,
        w_wr: 0,
        b_wr: 0,
        draws_rate: 0
    };
}

function safeGetMoves(fen, next_fen, movesMap) {
    const fen_next_fen_str = fen + " " + next_fen;
    if (movesMap.has(fen_next_fen_str)) {
        return movesMap.get(fen_next_fen_str);
    }
    return {
        fen: fen,
        next_fen: next_fen,
        fen_next_fen_str: fen_next_fen_str,
        times_played: 0
    };
}

const movesFromFenMoves = `
    query getMovesFromFenMoves(
        $fenMoves: [String],
    ) {
        Moves (
            where: {
                fen_next_fen_str: {
                    _in: $fenMoves
                }
            }
        ) {
            id
            fen
            next_fen
            times_played
            fen_next_fen_str
        }
    }
`;

async function fetchGameMoves(fenMoves) {
    const result = await client
        .query(movesFromFenMoves, {
            fenMoves,
        })
        .toPromise()

    if (result.error) {
        throw new Error(result.error);
    }

    return result?.data?.Moves;
}

const boardStatesFromFens = `
    query getBoardStatesFromFens(
        $fens: [String],
    ) {
        BoardStates (
            where: {
                fen: {
                    _in: $fens
                }
            }
        ) {
            id
            fen
            w_wins
            b_wins
            w_wr
            b_wr
            draws
            draws_rate
        }
    }
`;

async function fetchGameStates(fens) {
    const result = await client
        .query(boardStatesFromFens, {
            fens,
        })
        .toPromise()

    if (result.error) {
        throw new Error(result.error);
    }

    return result?.data?.BoardStates;
}

function compileGameFens(str) {
    let arr = str.replace(/([{].*[}])/, '').split(/\s+/).filter((word) => !word.match(/\d+[.]/) && word.length > 0);

    if (arr.length == 0) {
        return {
            fens: [], result: {
                w_win: 0,
                b_win: 0,
                draw: 0
            }
        };
    }

    let game = new Chess();

    let score = arr.pop();

    let result = {
        w_win: score.split('-')[0] == "1" ? 1 : 0,
        b_win: score.split('-')[1] == "1" ? 1 : 0,
        draw: score.split('-')[0] != "1" && score.split()[1] != "1" ? 1 : 0
    };
    
    // const whiteWin = parseInt(arr.pop()[0]);
    // const blackWin = parseInt(arr.pop()[2]);
    let fen = fenToState(game.fen());
    let fens = [];
    fens.push(fen);

    while (arr.length > 0) {
        let pgnMove = arr.shift()
        game.move(pgnMove);
        let len = fens.length;
        let s = fenToState(game.fen());
        if (len > 0 && s == fens[len - 1]) {
            return {
                fens: [], result: {
                    w_win: 0,
                    b_win: 0,
                    draw: 0
                }
            };
        }
        fens.push(s);
    }

    return { fens, result };
}