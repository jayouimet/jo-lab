export default function fenToState(fen) {
    return fen.replace(/(\s+\d+[\s]\d+)/, '');
}