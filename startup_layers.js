/// <reference types="@mapeditor/tiled-api" />
/*
MIT License

Copyright (c) 2023 Grif_on

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

//Intended for use in Tiled 1.8.6

class LocalUtils {
    static getUniqueString() {
        let str = this._nextUniqueNumber.toString();
        str = "0".repeat(Math.max((6 - str.length), 0)) + str;
        this._nextUniqueNumber++
        return str;
    }
}
LocalUtils._nextUniqueNumber = 0;

class MicroLayer {
    constructor() {
        this.name = "all";
        this.opacity = 1;
        this.tintColor = "#ffffff";
        this.visible = true;
        this.locked = false;
        this.selected = false;
        this.type = "ObjectLayer";
        this.depth = 0;
    }

    /**
     * Копирует определённые параметры объекта слоя Тайлида в экземпляр этого MicroLayer .
     * @param {Layer} tiledLayer - объект слоя Тайлида .
     */
    copyFromTiledLayer(tiledLayer) {
        this.name = tiledLayer.name;
        this.opacity = tiledLayer.opacity;
        this.tintColor = tiledLayer.tintColor;
        this.visible = tiledLayer.visible;
        this.locked = tiledLayer.locked;
        this.selected = tiledLayer.selected;
        if (tiledLayer.isTileLayer) this.type = "TileLayer";
        if (tiledLayer.isImageLayer) this.type = "ImageLayer";
        if (tiledLayer.isObjectLayer) this.type = "ObjectLayer";
        if (tiledLayer.isGroupLayer) this.type = "GroupLayer";
        this.depth = (tiledLayer.property("depth") !== undefined) ? tiledLayer.property("depth") : 0;
        return this;
    }

    /**
     * Копирует определённые параметры объекта джаваскрипта в экземпляр этого MicroLayer .
     * @param {Object} jsObject 
     */
    copyFromObject(jsObject) {
        this.name = jsObject.name;
        this.opacity = jsObject.opacity;
        this.tintColor = jsObject.tintColor;
        this.visible = jsObject.visible;
        this.locked = jsObject.locked;
        this.selected = jsObject.selected;
        this.type = jsObject.type;
        this.depth = jsObject.depth;
        return this;
    }

    /**
     * Возвращает новый объект слоя Тайлида , 
     * с установленными параметрами взятыми из экземпляра этого MicroLayer .  
     */
    constructTiledLayer() {
        let layer;
        switch (this.type) {
            case "TileLayer":
                layer = new TileLayer(); break;
            case "ImageLayer":
                layer = new ImageLayer(); break;
            case "ObjectLayer": default:
                layer = new ObjectGroup(); break;
            case "GroupLayer":
                layer = new GroupLayer();
                tiled.warn("Sorry , game doesn't support Group Layers , so they are not supported in script neither ." + "\n\tIn \"" + scriptName + "\"")
                return null;
                break;
        }
        layer.name = this.name;
        layer.opacity = this.opacity;
        layer.tintColor = this.tintColor;
        layer.visible = this.visible;
        layer.locked = this.locked;
        layer.selected = this.selected;
        layer.setProperty("depth", this.depth);
        return layer
    }

    /**
     * Возвращает строку приемлимую для MicroLayer.LoadLayout() или записи в файл .
     * Перед получением строки можно модифицировать необходимые поля за счёт функции modificator .
     * @param {Asset} map 
     * @param {Function} modificator 
     */
    static getCurrentLayout(map, modificator = function () { }) {
        let accStr = "";
        for (let i = 0; i < map.layerCount; i++) {
            if (i !== 0) accStr += ",\n";
            accStr += "\"" + i + "\": \n";
            let microLayer = new MicroLayer();
            microLayer.copyFromTiledLayer(map.layerAt(i), i);
            modificator.call(microLayer);
            accStr += JSON.stringify(microLayer, null, "\t");
        }
        return accStr;
    }

    /**
     * Создаёт слои в древе Тайлида на основе строки произведённой getCurrentLayout() .
     * Возвращает массив из MicroLayer использованных при загрузке .
     * @param {Asset} map 
     * @param {String} layout
     * @param {Number} offset
     */
    static loadLayout(map, layout, offset = 0) {
        offset *= -1;
        layout = JSON.parse("{\n" + layout + "\n}");
        let arrayOfMicroLayers = [];
        for (const number in layout) {
            let layer = layout[number];
            let microLayer = (new MicroLayer).copyFromObject(layer);
            arrayOfMicroLayers.push(microLayer);
            let tiledLayer = (microLayer.constructTiledLayer());
            if (tiledLayer !== null) map.insertLayerAt(number - offset, tiledLayer); else offset++;
        }
        return arrayOfMicroLayers;
    }

}


class LayoutManager {
    static registerAction(layoutRef) {
        let key = layoutRef.text.slice(9, layoutRef.text.length);
        LayoutManager._layouts.set(key, layoutRef);
        tiled.log("registered")
    }
    static deleteAction(keyName) {
        let layoutRef = LayoutManager._layouts.get(keyName);
        if (layoutRef) {
            layoutRef.enabled = false;
            layoutRef.checked = false;
            layoutRef.text = "[DELETED]";
            LayoutManager._layouts.delete(keyName);
            if (File.exists(globalTiledPath + "/storage/startup_layers/" + keyName + ".config")) {
                if (File.remove(globalTiledPath + "/storage/startup_layers/" + keyName + ".config")) {
                    LayoutManager.switchTo(defaultLayoutRef);
                    setSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini", defaultLayoutRef);
                    tiled.log("deleted");
                }
            } else {
                tiled.warn("Can't find \"" + keyName + "\" or smomething wrong in \"deleteAction\" method" + "\n\tIn \"" + scriptName + "\"");
            }
        }
    }
    static switchTo(layoutRef) {
        if (typeof (layoutRef) === "string") { layoutRef = LayoutManager._layouts.get(layoutRef); }
        let key = layoutRef.text.slice(9, layoutRef.text.length);
        LayoutManager._layouts.forEach((ref, name) => {
            if (name === key) ref.checked = true; else ref.checked = false;
        });
        tiled.log("switched to | \"" + key + "\" | " + layoutRef);
    }
    static printAllRegistered() {
        tiled.log("\t\tLayoutManager");
        LayoutManager._layouts.forEach((ref, name) => {
            tiled.log("name = " + name + (" ").repeat(40 - Math.min(Math.max(name.length, 0), 39)) + "ref = " + ref);
        });
    }
    static isEmpty() {
        return (LayoutManager._layouts.size < 1);
    }
}
LayoutManager._layouts = new Map;



let scriptPathName = __filename;
let scriptName = FileInfo.fileName(scriptPathName);

let globalScriptsPath = tiled.extensionsPath;
let globalTiledPath = globalScriptsPath.slice(0, globalScriptsPath.lastIndexOf("/"));
if (!File.exists(globalTiledPath + "/storage/startup_layers")) {
    File.makePath(globalTiledPath + "/storage/startup_layers");
}

tiled.log("scriptPathName = " + scriptPathName);
tiled.log("scriptName = " + scriptName);
tiled.log("globalScriptsPath = " + globalScriptsPath);
tiled.log("globalTiledPath = " + globalTiledPath);

function checkOptions(where) {
    let map = tiled.activeAsset;
    if (!File.exists(where + "/options.ini")) {
        let optionsW = new TextFile(where + "/options.ini", TextFile.ReadWrite);
        optionsW.write("default");
        optionsW.close();
        if (!(LayoutManager.isEmpty())) LayoutManager.switchTo("default");
        if (!File.exists(where + "/blank.config")) {
            let configW = new TextFile(where + "/blank.config", TextFile.ReadWrite);
            configW.write("");
            configW.close();
        }
        if (!File.exists(where + "/one object layer.config")) {
            let configW = new TextFile(where + "/one object layer.config", TextFile.ReadWrite);
            let microLayer = new MicroLayer();
            microLayer.selected = true;
            configW.write("\"0\":\n" + JSON.stringify(microLayer, null, "\t"));
            configW.close();
        }
    }
}
checkOptions(globalTiledPath + "/storage/startup_layers");

function getConfigsNames(where) {
    let storageOfStartupLayers = File.directoryEntries(where, 2); //2 - only files
    let configs = [];
    storageOfStartupLayers.forEach(element => {
        if ((!(element === "default.config")) || (!(element === "default images.config"))) { //игнорировать одноимённый конфиг в storage , для людей которые догадаються вручную создать такую копию
            if (element.endsWith(".config")) configs.push(element.slice(0, element.length - 7));
        }
    });
    return configs;
}

function getSelectedLayout(optionsPath) {
    let optionsR = new TextFile(optionsPath, TextFile.ReadOnly);
    let selectedLayout = optionsR.readAll();
    optionsR.close();
    return selectedLayout;
}

function setSelectedLayout(optionsPath, layoutRef) {
    let key = layoutRef.text.slice(9, layoutRef.text.length);
    let configW = new TextFile(optionsPath, TextFile.ReadWrite);
    tiled.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
    configW.truncate();
    configW.write(key);
    configW.close();
}


//================================== menu initialization ==================================//

let selectedLayout = getSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini");


const SaveCurrentLayersLayout = tiled.registerAction("Save current layers layout", function () {
    selectedLayout = getSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini");
    let initialName = (selectedLayout === "default" && selectedLayout === "default images") ? "" : selectedLayout;
    let map = tiled.activeAsset;
    if (map === null) return;

    let removeSelection = tiled.confirm("Mark all layers in layout as \"not selected\" ?", "Remove selection ?");
    let layoutName = tiled.prompt("Name your layout", initialName, "Name");

    //replace new line with " " + remove any whitespaces from begin and end + replace windows forbidden characters with "_" + secure forbidden filenames
    layoutName = layoutName.replace(/\n/gm, " ").replace(/(^\s+)|(\s+$)/g, "").replace(/[<>:"/\\|?*\x00-\x1F\x80-\x9f]/g, "_").replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, x => x + "_");
    if (layoutName.length > 248) { layoutName = layoutName.slice(0, 248); } // 248(name) + 7(.config) = 255

    switch (layoutName) {
        case "default": tiled.alert("You can't overwrite \"default\" layout (because it is auto updated via steam)");
        case "default images": tiled.alert("You can't overwrite \"default images\" layout (because it is auto updated via steam)");
        case "": return //cancel button or empty name
        default: break;
    }
    // let magik = (new Map([["default", function () { tiled.alert("You can't overwrite \"default\" layout (because it is auto updated via steam)"); return true; }], ["default images", function () { tiled.alert("You can't overwrite \"default images\" layout (because it is auto updated via steam)"); return true; }], ["", function () { return true; }]])).get(layoutName); if (magik) { magik.call(null); return; }

    let overwrite = true;
    let AddNewMenuEntry = true;
    if (getConfigsNames(globalTiledPath + "/storage/startup_layers").includes(layoutName)) {
        overwrite = tiled.confirm("\"" + layoutName + "\" already exist . Do you want to overwrite it ?", "Overwrite ?")
        AddNewMenuEntry = false;
    }
    if (!overwrite) return;

    let configW = new TextFile(globalTiledPath + "/storage/startup_layers/" + layoutName + ".config", TextFile.ReadWrite);
    configW.truncate();
    (removeSelection) ? configW.write(MicroLayer.getCurrentLayout(map, function () { this.selected = false })) : configW.write(MicroLayer.getCurrentLayout(map));
    configW.close();

    if (AddNewMenuEntry) {
        let systemName = "layout_" + layoutName.replace(new RegExp(" ", "g"), "_") + "_" + LocalUtils.getUniqueString();
        const layoutRef = tiled.registerAction(systemName, function () {
            LayoutManager.switchTo(layoutRef);
            setSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini", layoutRef);
        });
        layoutRef.text = "layout - " + layoutName;
        layoutRef.checkable = true;
        layoutRef.iconVisibleInMenu = false;
        LayoutManager.registerAction(layoutRef);
        tiled.extendMenu("File", [
            { action: systemName, before: "Delete selected layout" }
        ]);
    }

})

if (tiled.activeAsset === null) SaveCurrentLayersLayout.enabled = false;

SaveCurrentLayersLayout.text = "Save current layers layout";
SaveCurrentLayersLayout.icon = "ext:save.png";

tiled.extendMenu("File", [
    { separator: true },
    { action: "Save current layers layout", before: "Close" }
]);

tiled.activeAssetChanged.connect(function (map) {
    tiled.log("active changed");
    SaveCurrentLayersLayout.enabled = (!(map === null));
});

let configs = getConfigsNames(globalTiledPath + "/storage/startup_layers");
tiled.log("Found startup_layers configs = " + configs);



let systemName = "layout_default_" + LocalUtils.getUniqueString();
const defaultLayoutRef = tiled.registerAction(systemName, function () {
    LayoutManager.switchTo(defaultLayoutRef);
    setSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini", defaultLayoutRef);
});
defaultLayoutRef.text = "layout - default";
defaultLayoutRef.checkable = true;
defaultLayoutRef.iconVisibleInMenu = false;
LayoutManager.registerAction(defaultLayoutRef);
tiled.extendMenu("File", [
    { action: systemName, before: "Close" }
]);

systemName = "layout_default_images_" + LocalUtils.getUniqueString();
const defaultImagesLayoutRef = tiled.registerAction(systemName, function () {
    LayoutManager.switchTo(defaultImagesLayoutRef);
    setSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini", defaultImagesLayoutRef);
});
defaultImagesLayoutRef.text = "layout - default images";
defaultImagesLayoutRef.checkable = true;
defaultImagesLayoutRef.iconVisibleInMenu = false;
LayoutManager.registerAction(defaultImagesLayoutRef);
tiled.extendMenu("File", [
    { action: systemName, before: "Close" }
]);

configs.forEach(element => {
    let systemName = "layout_" + element.replace(new RegExp(" ", "g"), "_") + "_" + LocalUtils.getUniqueString();
    const layoutRef = tiled.registerAction(systemName, function () {
        LayoutManager.switchTo(layoutRef);
        setSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini", layoutRef);
    });
    layoutRef.text = "layout - " + element;
    layoutRef.checkable = true;
    layoutRef.iconVisibleInMenu = false;
    LayoutManager.registerAction(layoutRef);
    tiled.extendMenu("File", [
        { action: systemName, before: "Close" }
    ]);
});



if (configs.includes(selectedLayout)) {
    LayoutManager.switchTo(selectedLayout);
} else {
    if (selectedLayout !== "default" && selectedLayout !== "default images") tiled.warn("can't find \"" + selectedLayout + "\" , switched to \"default\"" + "\n\tIn \"" + scriptName + "\"");
    LayoutManager.switchTo("default");
    setSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini", defaultLayoutRef);
}

//================================== new map created ==================================//
let cashedArrayOfMicroLayers = null;
tiled.assetCreated.connect(function (map) {
    map.macro("Load layers from config", function () {
        checkOptions(globalTiledPath + "/storage/startup_layers");

        let optionsR = new TextFile(globalTiledPath + "/storage/startup_layers/options.ini", TextFile.ReadOnly);
        let selectedLayout = optionsR.readAll();
        optionsR.close();

        let configR;
        switch (selectedLayout) {
            case "default":
            case "":
                configR = new TextFile("ext:default.config", TextFile.ReadOnly);
                cashedArrayOfMicroLayers = MicroLayer.loadLayout(map, configR.readAll(), map.layerCount);
                configR.close();
                break;
            case "default images":
                configR = new TextFile("ext:default images.config", TextFile.ReadOnly);
                cashedArrayOfMicroLayers = MicroLayer.loadLayout(map, configR.readAll(), map.layerCount);
                configR.close();
                break;
            default:
                if (File.exists(globalTiledPath + "/storage/startup_layers/" + selectedLayout + ".config")) {
                    configR = new TextFile(globalTiledPath + "/storage/startup_layers/" + selectedLayout + ".config", TextFile.ReadOnly);
                    cashedArrayOfMicroLayers = MicroLayer.loadLayout(map, configR.readAll(), map.layerCount);
                    configR.close();
                } else {
                    tiled.warn("Can't find \"" + selectedLayout + "\" , switched to \"default\"" + "\n\tIn \"" + scriptName + "\"")
                    LayoutManager.switchTo("default");
                    setSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini", defaultLayoutRef);
                    cashedArrayOfMicroLayers = null;
                }
                break;
        }
        map.removeLayerAt(0); //Delete default "Tile Layer 1"
    });

    let reselectLayers = function () {
        map.selectedLayersChanged.disconnect(reselectLayers); // дисконект должен быть в начале функции , иначе возможна рекурсия  
        map.selectedLayers = [];
        if (cashedArrayOfMicroLayers !== null) {
            let arrayOfTiledLayers = [];
            for (let i = 0; i < cashedArrayOfMicroLayers.length; i++) {
                const microLayer = cashedArrayOfMicroLayers[i];
                if (microLayer.selected === true) arrayOfTiledLayers.push(map.layerAt(i));
            }
            if (arrayOfTiledLayers.length > 0) map.selectedLayers = arrayOfTiledLayers;
        }
    }
    map.selectedLayersChanged.connect(reselectLayers); // тайлид автовыбирает самый нижний слой в "следующем кадре" , так что , приходится так вот исхищрятся
})


const DeleteSelectedLayout = tiled.registerAction("Delete selected layout", function () {
    let selectedLayout = getSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini");
    switch (selectedLayout) {
        case "default":
            tiled.alert("You can't delete \"default\" layout file (because it is auto updated via steam) .", "No plz");
            break;
        case "default images":
            tiled.alert("You can't delete \"default images\" layout file (because it is auto updated via steam) .", "No plz");
            break;
        default:
            if (!(tiled.confirm("This will permanently delete \"" + selectedLayout + ".confg\" file .", "Are you sure ?"))) return;
            LayoutManager.deleteAction(selectedLayout);
            LayoutManager.switchTo("default");
            setSelectedLayout(globalTiledPath + "/storage/startup_layers/options.ini", defaultLayoutRef);
            break;
    }
});

DeleteSelectedLayout.text = "Delete selected layout";
DeleteSelectedLayout.icon = "ext:delete.png";
// DeleteSelectedLayout.icon = "";
tiled.extendMenu("File", [
    { action: "Delete selected layout", before: "Close" }
]);


const AboutStartupLayers = tiled.registerAction("About startup layers", function () {
    let message = "\t     \"Startup layers\" by Grif_on .\n\
    Configuration files stored in \"" + globalTiledPath + "/storage/startup_layers\" .\n\
    Manual deleting of \"options.ini\" and creating of new map will restore built in layouts if they were deleted (\"blank\" and \"one object layer\") .\n\
    Github page of this script - https://github.com/grif-on/startup_layers .\n\n\
    This message also printed in to tiled console log .";
    tiled.log("=".repeat(123) + "\n" + message + "\n" + "=".repeat(123));
    tiled.alert(message, "About startup layers");
});
AboutStartupLayers.text = "About startup layers";
AboutStartupLayers.icon = "ext:about.png";
// AboutStartupLayers.icon = "";
tiled.extendMenu("File", [
    { action: "About startup layers", before: "Close" },
    { separator: true }
]);

// tiled.log(tiled.actions); // получить имена всех экшонов (для использования в "before")

tiled.log(LayoutManager.printAllRegistered());
