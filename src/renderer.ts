import { ipcRenderer } from "electron";
import * as RECORDING from './recording/RecordingData';
import Timeline from './timeline/timeline';
import ConnectionsList from './frontend/ConnectionsList';
import FileListController from "./frontend/FileListController";
import * as BASICO from './ui/ui';
import * as NET_TYPES from './network/types';
import SceneController from './render/sceneController';
import * as Messaging from "./messaging/MessageDefinitions";
import { _TypeStore } from "babylonjs";
import { PlaybackController } from "./timeline/PlaybackController";
import { PropertyTreeController } from "./frontend/PropertyTreeController";
import { ConsoleWindow } from "./frontend/ConsoleController";

export default class Renderer {
    private sceneController: SceneController;
    private recordedData: RECORDING.NaiveRecordedData;
    private timeline: Timeline;
    private currentPropertyId: number;

    // Per frame cache
    private frameData: RECORDING.IFrameData;

    // UI Elements
    private propertyTree: BASICO.TreeControl;
    private entityList: BASICO.ListControl;
    private selectedEntityId: number;
    private propertyTreeController: PropertyTreeController;

    // Networking
    private connectionsList: ConnectionsList;

    // Recent files
    private recentFilesController: FileListController;

    // Console
    private consoleWindow : ConsoleWindow;

    // Playback
    private playbackController: PlaybackController;

    initialize(canvas: HTMLCanvasElement) {

        this.playbackController = new PlaybackController(this);

        this.sceneController = new SceneController();
        this.sceneController.initialize(canvas);
        this.sceneController.onEntitySelected = this.onEntitySelected.bind(this);

        this.selectedEntityId = null;

        this.initializeTimeline();
        this.initializeUI();

        this.recordedData = new RECORDING.NaiveRecordedData();
        //this.recordedData.addTestData();

        this.timeline.updateLength(this.recordedData.getSize());

        let connectionsListElement: HTMLElement = document.getElementById(`connectionsList`);
        this.connectionsList = new ConnectionsList(connectionsListElement, this.onMessageArrived.bind(this));
        this.connectionsList.initialize();

        let recentFilesListElement: HTMLElement = document.getElementById(`recentFilesList`);
        this.recentFilesController = new FileListController(recentFilesListElement, this.onRecentFileClicked.bind(this))

        this.propertyTreeController = new PropertyTreeController(this.propertyTree);

        this.applyFrame(0);
    }

    initializeUI()
    {
        // Create tree
        let treeParent = document.getElementById('property-tree');
        this.propertyTree = new BASICO.TreeControl(treeParent);

        this.currentPropertyId = 0;
        
        var trans = this.propertyTree.addItem(this.propertyTree.root, "Transform", false, this.getNextPropertyId());
        this.propertyTree.addItem(trans, "Position: 12 56 32", true, this.getNextPropertyId());

        var nav = this.propertyTree.addItem(this.propertyTree.root, "Navigation", false, this.getNextPropertyId());
        var targetData = this.propertyTree.addItem(nav, "Target Data", true, this.getNextPropertyId());
        this.propertyTree.addItem(targetData, "Position: 50 150 32", true, this.getNextPropertyId());
        this.propertyTree.addItem(targetData, "Distance: 12", true, this.getNextPropertyId());

        const entityListElement = <HTMLElement>document.getElementById('entity-list').querySelector('.basico-list');

        this.entityList = new BASICO.ListControl(entityListElement);

        // Create tab control
        var controlTabs = new BASICO.TabControl(
            <HTMLElement[]><any>document.getElementById("control-tabs").children,
            [
                document.getElementById("entity-list"), 
                document.getElementById("var-list"),
                document.getElementById("connection-list"),
                document.getElementById("recent-list"),
                document.getElementById("setting-list")
            ]
            , 0, BASICO.TabBorder.Left
        );

        var controlTabs = new BASICO.TabControl(
            [
                document.getElementById("console-tabs").children[0] as HTMLElement
            ],
            [
                document.getElementById("default-console")
            ]
            , 0, BASICO.TabBorder.Left
        );

        const consoleElement = document.getElementById("default-console").children[0] as HTMLElement;
        console.log(consoleElement);
        this.consoleWindow = new ConsoleWindow(consoleElement);
        this.consoleWindow.logError("Error: test");

        // Create timeline callbacks
        document.getElementById("timeline-play").onclick = this.playbackController.onTimelinePlayClicked.bind(this.playbackController);
        document.getElementById("timeline-next").onclick = this.playbackController.onTimelineNextClicked.bind(this.playbackController);
        document.getElementById("timeline-prev").onclick = this.playbackController.onTimelinePrevClicked.bind(this.playbackController);
        document.getElementById("timeline-first").onclick = this.playbackController.onTimelineFirstClicked.bind(this.playbackController);
        document.getElementById("timeline-last").onclick = this.playbackController.onTimelineLastClicked.bind(this.playbackController);

        // Create control bar callbacks
        document.getElementById("control-bar-open").onclick = this.onOpenFile.bind(this);
        document.getElementById("control-bar-save").onclick = this.onSaveFile.bind(this);
        document.getElementById("control-bar-clear").onclick = this.onClearFile.bind(this);

        // Console callbacks
        document.getElementById("console-clear").onclick = () => { this.consoleWindow.clear(); };
    }

    loadData(data: string)
    {
        this.recordedData.loadFromString(data);
        this.timeline.updateLength(this.recordedData.getSize());
        this.applyFrame(0);
    }

    clear()
    {
        this.recordedData.clear();
        this.timeline.updateLength(this.recordedData.getSize());
        this.applyFrame(0);
    }

    onMessageArrived(data: string) : void
    {
        let message: NET_TYPES.IMessage = JSON.parse(data) as NET_TYPES.IMessage;

        console.log("Received: " + data);
        console.log(message);

        // TODO: Make message types: frame data, command, etc. In an enum.
        // Also, move to a helper class
        if (message.type !== undefined)
        {
            switch(message.type)
            {
                case NET_TYPES.MessageType.FrameData:
                {
                    let frame: NET_TYPES.IMessageFrameData = message.data;

                    // Build frame
                    let frameToBuild: RECORDING.IFrameData = {
                        entities: {},
                        frameId: frame.frameId,
                        elapsedTime: frame.elapsedTime,
                        tag: frame.tag,
                    };

                    // Add all entity data
                    const length = frame.entities.length;
                    for (let i=0; i<length; ++i)
                    {
                        const entityData = frame.entities[i];
                        frameToBuild.entities[entityData.id] = entityData;
                    }

                    this.recordedData.pushFrame(frameToBuild);
                    this.timeline.updateLength(this.recordedData.getSize());

                    console.log(frameToBuild);
                }
                break;
            }
        }
    }

    getNextPropertyId() : string
    {
        return (++this.currentPropertyId).toString();
    }

    applyFrame(frame : number) {
        this.frameData = this.recordedData.buildFrameData(frame);

        this.timeline.currentFrame = frame;
        this.playbackController.updateUI();

        //console.log(this.frameData);
        //console.log(this.recordedData);

        // Update frame counter
        document.getElementById("timeline-frame-counter").textContent = `Frame: ${frame + 1} / ${this.getFrameCount()}`;

        // Update entity list
        let listElement = this.entityList.listWrapper;

        this.sceneController.hideAllEntities();

        let counter = 0;
        for (let entityID in this.frameData.entities) {
            let element = <HTMLElement>listElement.children[counter];

            const entity = this.frameData.entities[entityID];
            const entityName = RECORDING.NaiveRecordedData.getEntityName(entity);
            
            // Set in the scene renderer
            this.sceneController.setEntity(entity);

            if (element) {
                element.innerText = entityName;
                this.entityList.setValueOfItem(element, entityID);
            }
            else {
                this.entityList.appendElement(entityName, function(element) {
                    renderer.onEntitySelected(parseInt(renderer.entityList.getValueOfItem(element)));
                }, entityID);
            }
            counter++;
        }

        // Remove remaining elements
        const remainingElements = listElement.childElementCount;
        for (let i=counter; i<remainingElements; i++)
        {
            let element = <HTMLElement>listElement.children[counter];
            listElement.removeChild(element);
        }

        // Draw properties
        this.renderProperties();

        // Rebuild property tree
        this.buildPropertyTree();
    }

    onEntitySelected(entityId: number)
    {
        console.log("Selected: " + entityId);
        this.selectedEntityId = entityId;
        this.buildPropertyTree();
        this.entityList.selectElementOfValue(entityId.toString());
        this.sceneController.markEntityAsSelected(entityId);
        this.renderProperties();
    }

    buildPropertyTree()
    {
        this.propertyTree.clear();

        if (this.selectedEntityId != null)
        {
            const selectedEntity = this.frameData.entities[this.selectedEntityId];

            if (selectedEntity)
            {
                for (let i=0; i<selectedEntity.properties.length; ++i)
                {
                    this.propertyTreeController.addToPropertyTree(this.propertyTree.root, selectedEntity.properties[i]);
                }
            }
        }
    }

    renderProperties()
    {
        let sceneController = this.sceneController;
        sceneController.removeAllProperties();

        for (let entityID in this.frameData.entities) {
            const entity = this.frameData.entities[entityID];

            this.recordedData.visitEntityProperties(entity, function(property: RECORDING.IProperty) {
                sceneController.addProperty(entity, property);
            });
        }
        /*if (this.selectedEntityId != null)
        {
            const selectedEntity = this.frameData.entities[this.selectedEntityId];
            if (selectedEntity)
            {
                let sceneController = this.sceneController;
                sceneController.removeAllProperties();

                this.recordedData.visitEntityProperties(selectedEntity, function(property: RECORDING.IProperty) {
                    sceneController.addProperty(selectedEntity, property);
                });
            }
        }*/
    }

    initializeTimeline()
    {
        let timelineElement: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById('timeline');
        let timelineWrapper: HTMLElement = document.getElementById('timeline-wrapper');
        this.timeline = new Timeline(timelineElement, timelineWrapper);
        this.timeline.setFrameClickedCallback(this.onTimelineClicked.bind(this));
        this.timeline.setTimelineUpdatedCallback(this.onTimelineUpdated.bind(this));
    }

    getCurrentFrame()
    {
        return this.timeline.currentFrame;
    }

    getFrameCount()
    {
        return this.timeline.length;
    }

    getElapsedTimeOfFrame(frame: number)
    {
        if (frame == this.getCurrentFrame())
        {
            return this.frameData.elapsedTime;
        }
        else
        {
            return this.recordedData.buildFrameData(frame).elapsedTime;
        }
    }

    updateRecentFiles(paths: string[])
    {
        this.recentFilesController.updateRecentFiles(paths);
    }

    // Timeline callbacks
    onTimelineClicked(frame: number)
    {
        this.applyFrame(frame);
    }

    onTimelineUpdated(elapsedSeconds: number)
    {
        this.playbackController.update(elapsedSeconds);
    }

    // Control bar callbacks
    onOpenFile()
    {
        ipcRenderer.send('asynchronous-message', new Messaging.Message(Messaging.MessageType.Open, ""));
    }
    
    onSaveFile()
    {
        ipcRenderer.send('asynchronous-message', new Messaging.Message(Messaging.MessageType.Save, JSON.stringify(this.recordedData)));
    }

    onClearFile()
    {
        ipcRenderer.send('asynchronous-message', new Messaging.Message(Messaging.MessageType.Clear, ""));
    }

    // Recent files callbacks
    onRecentFileClicked(path: string)
    {
        ipcRenderer.send('asynchronous-message', new Messaging.Message(Messaging.MessageType.Load, path));
    }

    // Logging
    logToConsole(message: string)
    {
        this.consoleWindow.logMessage(message);
    }

    logErrorToConsole(message: string)
    {
        this.consoleWindow.logError(message);
    }
}

const renderer = new Renderer();
renderer.initialize(document.getElementById('render-canvas') as HTMLCanvasElement);

ipcRenderer.on('asynchronous-reply', (event: any, arg: Messaging.Message) => {
    console.log(arg);
    switch(arg.type)
    {
        case Messaging.MessageType.OpenResult:
        {
            renderer.loadData(arg.data as string)
            break;
        }
        case Messaging.MessageType.ClearResult:
        {
            const result = arg.data as Messaging.IClearResultData;
            if (result.clear)
            {
                renderer.clear();
            }
            break;
        }
        case Messaging.MessageType.RequestSave:
        {
            renderer.onSaveFile();
            break;
        }
        case Messaging.MessageType.UpdateRecentFiles:
        {
            const recentFiles = (arg.data as string).split(",");
            console.log(recentFiles);
            renderer.updateRecentFiles(recentFiles);
            break;
        }
        case Messaging.MessageType.LogToConsole:
        {
            renderer.logToConsole(arg.data as string);
            break;
        }
        case Messaging.MessageType.LogErrorToConsole:
        {
            renderer.logErrorToConsole(arg.data as string);
            break;
        }
    }
});