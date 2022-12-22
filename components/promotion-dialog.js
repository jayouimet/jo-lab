import { useEffect, useRef } from "react";
import Piece from "./piece";
import styles from "./promotion-dialog.module.css";

function useOutsideAlerter(ref, callback) {
    useEffect(() => {
        function handleClickOutside(event) {
            if (ref.current && !ref.current.contains(event.target)) {
                callback();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
            return () => {
            // Unbind the event listener on clean up
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [ref]);
}

export default function PromotionDialog ({visible = false, left = 0, top = 0, color, onSelectedValue, ...props}) {
    const style = {
        top: top,
        left: left,
        display: visible ? 'flex' : 'none'
    }

    const pieces = [
        { key: color + "Q", value: 'q' },
        { key: color + "N", value: 'n' },
        { key: color + "R", value: 'r' },
        { key: color + "B", value: 'b' },
        { key: "x", value: undefined },
    ];

    const wrapperRef = useRef(null);

    const handleClickOutside = () => {
        onSelectedValue(undefined);
    }

    useOutsideAlerter(wrapperRef, handleClickOutside);

    const renderPieces = () => {
        return pieces.map((piece) => {
            return (
                <Piece width={75} height={75} key={piece.key} piece={piece.key} onClick={() => onSelectedValue(piece.value)}/>
            );
        });
    }

    return (
        <div ref={wrapperRef} style={style} className={styles.container} {...props}>
            {renderPieces()}
        </div>
    );
}