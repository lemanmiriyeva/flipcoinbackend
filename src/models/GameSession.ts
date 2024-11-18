import mongoose, { Document, Schema } from 'mongoose';

export interface IGameSession extends Document {
    playerOne: string;
    playerTwo: string;
    result: string;
    createdAt: Date;
}

const GameSessionSchema: Schema = new Schema({
    playerOne: { type: String, required: true },
    playerTwo: { type: String, required: true },
    result: { type: String, required: false, default: 'tie' }, // Allow 'tie' as default
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IGameSession>('GameSession', GameSessionSchema);
