import { ISettings } from "../files/Settings";
import { filterText } from "../utils/utils";

export interface ISettingsChanged
{
    () : void
}

enum ControlType
{
    Toggle
}

interface ISingleSettingLayout
{
    name: string;
    control: ControlType;
}

interface ISettingsLayout
{
    [setting: string]: ISingleSettingLayout;
}

interface SettingsBuilderGroup
{
    fragment: DocumentFragment;
    list: HTMLElement;
}

interface IBooleanSettingCallback
{
    (value: boolean) : void
}

interface INumberSettingCallback
{
    (value: number) : void
}

const settingsLayout: ISettingsLayout =
{
    recordOnConnect: { control: ControlType.Toggle, name: "Record on Connect" },
    autoReconnect: { control: ControlType.Toggle, name: "Auto Re-connect" },
};

namespace SettingsBuilder
{
    export function createGroup(name: string) : SettingsBuilderGroup
    {
        let fragment = new DocumentFragment()

        let header: HTMLElement = document.createElement("div");
        header.classList.add("basico-title");
        header.innerText = name;
        fragment.appendChild(header);

        let list: HTMLElement = document.createElement("div");
        list.classList.add("basico-list");
        fragment.appendChild(list);

        return { fragment: fragment, list: list };
    }

    export function addNumberOptionsSetting(group: SettingsBuilderGroup, name: string, value: number, options: number[], callback: INumberSettingCallback)
    {
        group.list.appendChild(createNumberOptionsSetting(name, value, options, callback));
    }

    function createNumberOptionsSetting(name: string, value: number, options: number[], callback: INumberSettingCallback) : HTMLElement
    {
        let listItem: HTMLElement = document.createElement("div");
        listItem.className = "basico-list-item basico-no-hover";

        let dropdown: HTMLElement = createNumberDropdown(value, options, callback);

        let textItem: HTMLElement = document.createElement("div");
        textItem.className = "basico-text-oneline";
        textItem.innerText = name;

        listItem.append(dropdown, textItem);


        return listItem;
    }

    export function addBooleanSetting(group: SettingsBuilderGroup, name: string, value: boolean, callback: IBooleanSettingCallback)
    {
        group.list.appendChild(createBooleanSetting(name, value, callback));
    }

    function createBooleanSetting(name: string, value: boolean, callback: IBooleanSettingCallback) : HTMLElement
    {
        let listItem: HTMLElement = document.createElement("div");
        listItem.className = "basico-list-item basico-no-hover";

        let toggle: HTMLElement = createToggle(value, callback);
        listItem.appendChild(toggle);

        let textItem: HTMLElement = document.createElement("div");
        textItem.className = "basico-text-oneline";
        textItem.innerText = name;

        listItem.appendChild(textItem);

        return listItem;
    }

    function createDropdownEntry(name: string) : HTMLElement
    {
        let entry = document.createElement("a");
        entry.textContent = name;
        return entry;
    }

    function createNumberDropdown(value: number, options: number[], callback: INumberSettingCallback): HTMLElement
    {
        const dropdown = document.createElement("div");
        dropdown.className = "basico-dropdown";

        const dropdownButton = document.createElement("button");
        dropdownButton.className = "basico-dropdown-button";
        dropdownButton.textContent = value.toString();
        dropdown.appendChild(dropdownButton);

        const dropdownContent = document.createElement("div");
        dropdownContent.className = "basico-dropdown-content basico-right-align";
        dropdown.appendChild(dropdownContent);

        const entries = options.map((value) => {
            let entry = createDropdownEntry(value.toString());
            entry.onclick = () => {
                dropdownButton.textContent = value.toString();
                callback(value);
            };
            return entry;
        });

        dropdownContent.append(...entries);
        return dropdown;
    }

    function createToggle(active: boolean, callback: IBooleanSettingCallback): HTMLLabelElement
    {
        let label: HTMLLabelElement = document.createElement("label");
        label.classList.add("basico-toggle");

        let input: HTMLInputElement = document.createElement("input");
        input.type = "checkbox";
        input.checked = active;
        input.addEventListener("change", (event) => {
            const checkbox = (event.target as HTMLInputElement);
            callback(checkbox.checked);
        });

        let span: HTMLSpanElement = document.createElement("span");
        span.classList.add("slider", "round");

        label.appendChild(input);
        label.appendChild(span);

        return label;
    }
}

export class SettingsList
{
    private onSettingsChanged: ISettingsChanged;
    private settingsList: HTMLElement;
    private searchFilter: HTMLInputElement;
    private filter: string;

    constructor(settingsList: HTMLElement, searchFilter: HTMLInputElement, onSettingsChanged: ISettingsChanged)
    {
        this.settingsList = settingsList;
        this.searchFilter = searchFilter;
        this.searchFilter.onkeyup = () => { this.filterElements(); };
        this.filter = "";
        this.onSettingsChanged = onSettingsChanged;
    }    

    setSettings(settings: ISettings)
    {
        this.settingsList.innerHTML = "";
        {
            let group = SettingsBuilder.createGroup("Connection");
            SettingsBuilder.addBooleanSetting(group, "Record on connect", settings.recordOnConnect, (value) => {settings.recordOnConnect = value; this.onSettingsChanged(); })
            SettingsBuilder.addBooleanSetting(group, "Auto re-connect", settings.autoReconnect, (value) => {settings.autoReconnect = value; this.onSettingsChanged(); })
            this.settingsList.appendChild(group.fragment);
        }
        {
            let group = SettingsBuilder.createGroup("Viewer");
            SettingsBuilder.addBooleanSetting(group, "Move camera on selection", settings.moveToEntityOnSelection, (value) => {settings.moveToEntityOnSelection = value; this.onSettingsChanged(); })
            SettingsBuilder.addBooleanSetting(group, "Open entity list on selection", settings.openEntityListOnSelection, (value) => {settings.openEntityListOnSelection = value; this.onSettingsChanged(); })
            SettingsBuilder.addBooleanSetting(group, "Follow selected entity", settings.followCurrentSelection, (value) => {settings.followCurrentSelection = value; this.onSettingsChanged(); })
            SettingsBuilder.addBooleanSetting(group, "Show all layers on start", settings.showAllLayersOnStart, (value) => {settings.showAllLayersOnStart = value; this.onSettingsChanged(); })
            this.settingsList.appendChild(group.fragment);
        }

        {
            let group = SettingsBuilder.createGroup("Debug");
            SettingsBuilder.addBooleanSetting(group, "Show render debug info", settings.showRenderDebug, (value) => {settings.showRenderDebug = value; this.onSettingsChanged(); })
            this.settingsList.appendChild(group.fragment);
        }

        {
            let group = SettingsBuilder.createGroup("Graphics");
            SettingsBuilder.addNumberOptionsSetting(group, "Anti-aliasing samples", settings.antialiasingSamples, [1, 2, 4, 8, 16], (value) => {  settings.antialiasingSamples = value; this.onSettingsChanged(); });
            this.settingsList.appendChild(group.fragment);
        }

        this.filterElements();
    }

    private filterElements()
    {
        this.filter = this.searchFilter.value.toLowerCase();

        // basico-text-oneline

        let settingsWrapper = this.settingsList;

        for (let i=0; i<settingsWrapper.childElementCount; i+=2)
        {
            let titleElement = <HTMLElement>settingsWrapper.children[i];
            let listElement = <HTMLElement>settingsWrapper.children[i + 1];

            let foundInTitle: boolean = false;
            let foundInGroup: boolean = false;

            if (titleElement && listElement)
            {
                foundInTitle = this.filter == "" || filterText(this.filter, titleElement.innerText.toLowerCase());
                foundInGroup = foundInTitle;
            }

            for (let j=0; j<listElement.childElementCount; ++j)
            {
                let settingElement = <HTMLElement>listElement.children[j];
                if (settingElement)
                {
                    if (foundInTitle)
                    {
                        settingElement.style.display = "block";
                    }
                    else
                    {
                        let nameElement: HTMLInputElement = settingElement.querySelector('.basico-text-oneline');
                        if (nameElement)
                        {
                            const foundInSetting = this.filter == "" || filterText(this.filter, nameElement.innerText.toLowerCase());
                            foundInGroup = foundInGroup || foundInSetting;
                            settingElement.style.display = foundInSetting ? "block" : "none";
                        }
                    }
                }
            }

            titleElement.style.display = foundInGroup ? "block" : "none";
            listElement.style.display = foundInGroup ? "block" : "none";
        }
    }
}