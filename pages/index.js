import { Chessboard } from 'react-chessboard';
import { Chess } from "chess.js";
import { useState } from 'react';
import { cloneDeep } from 'lodash';
import PromotionDialog from '../components/promotion-dialog';

export default function Home() {
    const chessGame = new Chess();
    const boardWidth = 560;
    const [game, setGame] = useState(chessGame);
    const [posDialog, setPosDialog] = useState({x: 0, y: 0});
    const [isVisibleDialog, setIsVisibleDialog] = useState(false);
    const [sourceSq, setSourceSq] = useState(undefined);
    const [targetSq, setTargetSq] = useState(undefined);

    const getNextMove = async () => {
        const body = {
            fen: game.fen()
        }
		try {
			const res = await fetch(
				`/api/chess/parser`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
			);
			const data = await res.json();
			console.log(data);
		} catch (err) {
			console.log(err);
		}
	};

    const makeAMove = (move) => {
        const result = game.move(move);
        const gameCopy = cloneDeep(game);
        setGame(gameCopy)
        return result
    }

    const makeRandomMove = () => {
        const possibleMoves = game.moves();
        if (game.isGameOver() || game.isDraw() || possibleMoves.length === 0)
            return;
        const rand = Math.floor(Math.random() * possibleMoves.length);
        makeAMove(possibleMoves[rand]);
    }

    const canPromote = (target, piece) => {
        if (piece === 'wP' && target[1] === '8')
            return true;
        else if (piece === 'bP' && target[1] === '1')
            return true;
        return false;
    }

    const onDrop = (sourceSquare, targetSquare, piece) => {
        const promo = canPromote(targetSquare, piece);

        setSourceSq(sourceSquare);
        setTargetSq(targetSquare);

        if (promo) {
            setPosDialog(getPosTarget(targetSquare));
            setIsVisibleDialog(true);
            return false;
        }
        
        const move = makeAMove({
            from: sourceSquare,
            to: targetSquare,
            promotion: promo ? 'q' : undefined
        });

        if (move == null) return false;

        setTimeout(makeRandomMove, 200);
        return true;
    }

    const getPosTarget = (targetSquare) => {
        const squareWidth = boardWidth / 8;
        return {
            y: squareWidth / 2,
            x: squareWidth * parseInt(targetSquare.charCodeAt(0) - 97) + squareWidth / 2
        }
    }

    const handleSelectedValue = (piece) => {
        setIsVisibleDialog(false);
        if (piece == undefined)
            return;

        const move = makeAMove({
            from: sourceSq,
            to: targetSq,
            promotion: piece
        });

        if (move == null) return;

        setTimeout(makeRandomMove, 200);
    }

    return (
        <div>
            <Chessboard id="chessboard" boardWidth={boardWidth} position={game.fen()} onPieceDrop={onDrop} />
            <PromotionDialog visible={isVisibleDialog} top={posDialog.y} left={posDialog.x} color={'w'} onSelectedValue={handleSelectedValue}/>
            <button onClick={getNextMove}>Make API Call</button>
        </div>
    )
}
