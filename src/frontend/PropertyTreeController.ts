import * as RECORDING from '../recording/RecordingData';
import * as BASICO from '../ui/ui';
import * as TypeSystem from "../types/typeRegistry";

export class PropertyTreeController {
    propertyTree: BASICO.TreeControl;
    typeRegistry: TypeSystem.TypeRegistry;

    constructor(propertyTree: BASICO.TreeControl) {
        this.propertyTree = propertyTree;
        this.typeRegistry = TypeSystem.TypeRegistry.getInstance();
    }

    getPrimitiveTypeAsString(value: any, primitiveType: TypeSystem.EPrimitiveType): string {
        switch (primitiveType) {
            case TypeSystem.EPrimitiveType.Number:
                {
                    // TODO: Either check type here, or validate incomming data so this is always valid data
                    return (+value.toFixed(2)).toString();
                }
            case TypeSystem.EPrimitiveType.String:
                {
                    return value;
                }
            case TypeSystem.EPrimitiveType.Boolean:
                {
                    return value;
                }
        }
    }

    wrapPrimitiveType(content: string): string
    {
        return `<div class="basico-tag basico-big property-primitive">${content}</div> `;
    }

    wrapPropertyGroup(content: string): string
    {
        return `<span class="property-group">${content}</span> `;
    }

    wrapPropertyName(content: string): string
    {
        return `<span class="property-name">${content}</span> `;
    }

    getLayoutOfPrimitiveType(value: any, primitiveType: TypeSystem.EPrimitiveType)
    {
        return this.wrapPrimitiveType(this.getPrimitiveTypeAsString(value, TypeSystem.EPrimitiveType.Number));
    }

    addValueToPropertyTree(parent: HTMLElement, name: string, content: string, propertyId: number = null)
    {
        const layout = `${this.wrapPropertyName(name)}${this.wrapPropertyGroup(content)}`;
        this.propertyTree.addItem(parent, layout, false, propertyId == null ? null : propertyId.toString());
    }

    addCustomTypeToPropertyTree(parent: HTMLElement, property: RECORDING.IProperty, type: TypeSystem.IType) {
        // Complex value type
        let content = '';
        for (const [layoutId, primitiveType] of Object.entries(type.layout)) {
            const customTypeValue = property.value as RECORDING.IPropertyCustomType;
            const value = customTypeValue[layoutId];
            if (value) {
                content += this.getLayoutOfPrimitiveType(value, primitiveType);
            }
        }

        this.addValueToPropertyTree(parent, property.name, content, property.id);
    }

    addVec3(parent: HTMLElement, name: string, value: RECORDING.IVec3, propertyId: number = null)
    {
        const content =
            this.getLayoutOfPrimitiveType(value.x, TypeSystem.EPrimitiveType.Number)
            + this.getLayoutOfPrimitiveType(value.y, TypeSystem.EPrimitiveType.Number)
            + this.getLayoutOfPrimitiveType(value.z, TypeSystem.EPrimitiveType.Number);

        this.addValueToPropertyTree(parent, name, content, propertyId);
    }

    addColor(parent: HTMLElement, name: string, value: RECORDING.IColor, propertyId: number = null)
    {
        const content =
            this.getLayoutOfPrimitiveType(value.r, TypeSystem.EPrimitiveType.Number)
            + this.getLayoutOfPrimitiveType(value.g, TypeSystem.EPrimitiveType.Number)
            + this.getLayoutOfPrimitiveType(value.b, TypeSystem.EPrimitiveType.Number);
            + this.getLayoutOfPrimitiveType(value.a, TypeSystem.EPrimitiveType.Number);

        this.addValueToPropertyTree(parent, name, content, propertyId);
    }

    addNumber(parent: HTMLElement, name: string, value: number, propertyId: number = null)
    {
        const content = this.getLayoutOfPrimitiveType(value, TypeSystem.EPrimitiveType.Number)
        this.addValueToPropertyTree(parent, name, content, propertyId);
    }

    addToPropertyTree(parent: HTMLElement, property: RECORDING.IProperty)
    {
        if (property.type == "group") {
            let addedItem = this.propertyTree.addItem(parent, property.name, false, property.id.toString());
            const propertyGroup = property as RECORDING.IPropertyGroup;

            for (let i = 0; i < propertyGroup.value.length; ++i) {
                this.addToPropertyTree(addedItem, propertyGroup.value[i]);
            }
        }


        // Find type
        else {
            const type = this.typeRegistry.findType(property.type);
            if (type) {
                this.addCustomTypeToPropertyTree(parent, property, type);
            }
            else if (property.type == "sphere") {
                const sphere = property as RECORDING.IPropertySphere;

                let addedItem = this.propertyTree.addItem(parent, property.name, false, property.id.toString());
                this.addVec3(addedItem, "Position", sphere.position);
                this.addNumber(addedItem, "Radius", sphere.radius);
            }
            else if (property.type == "aabb") {
                const aabb = property as RECORDING.IPropertyAABB;

                let addedItem = this.propertyTree.addItem(parent, property.name, false, property.id.toString());
                this.addVec3(addedItem, "Position", aabb.position);
                this.addVec3(addedItem, "Size", aabb.size);
            }
            else if (property.type == "oobb") {
                const oobb = property as RECORDING.IPropertyOOBB;

                let addedItem = this.propertyTree.addItem(parent, property.name, false, property.id.toString());
                this.addVec3(addedItem, "Position", oobb.position);
                this.addVec3(addedItem, "Size", oobb.size);
                this.addVec3(addedItem, "Forward", oobb.forward);
                this.addVec3(addedItem, "Up", oobb.up);
            }
            else if (property.type == "plane") {
                const plane = property as RECORDING.IPropertyPlane;

                let addedItem = this.propertyTree.addItem(parent, property.name, false, property.id.toString());
                this.addVec3(addedItem, "Position", plane.position);
                this.addVec3(addedItem, "Normal", plane.normal);
                this.addVec3(addedItem, "Up", plane.up);
                this.addNumber(addedItem, "Width", plane.width);
                this.addNumber(addedItem, "Length", plane.length);
            }
            else if (property.type == "line") {
                const line = property as RECORDING.IPropertyLine;

                let addedItem = this.propertyTree.addItem(parent, property.name, false, property.id.toString());
                this.addVec3(addedItem, "Origin", line.origin);
                this.addVec3(addedItem, "Destination", line.destination);
            }

            else {
                const primitiveType = TypeSystem.buildPrimitiveType(property.type);
                const value = primitiveType ? this.getPrimitiveTypeAsString(property.value, primitiveType) : property.value as string;
                const content = this.wrapPrimitiveType(value);
                this.addValueToPropertyTree(parent, property.name, content, property.id);
            }
        }
    }
}
