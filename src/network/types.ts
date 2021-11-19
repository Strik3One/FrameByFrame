import * as RECORDING from '../recording/RecordingData';

export enum MessageType
{
    FrameData = 0,
	RecordingOptions,
	RecordingOptionChanged
}

export interface IMessageFrameData {
	entities: RECORDING.IEntity[];
	frameId: number;
	elapsedTime: number;
	tag: string;
}

export interface IMessageRecordingOption
{
	name: string;
	enabled: boolean;
}

export interface IMessage {
    type: MessageType,
    data: IMessageFrameData | IMessageRecordingOption[]
}