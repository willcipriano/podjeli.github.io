"use strict";
const FILESELECTOR = $("#fileSelector");
const FILEREADER = new FileReader();
const MAXCHARS = 2000;
let FILESTRING;
let FILENAME;
let FILEMIME;
let FILEHASH;
let URLS = [];


function getQueryParam(name) {
    const results = new RegExp("[\?&]" + name + "=([^&#]*)")
        .exec(window.location.search);

    return (results !== null) ? results[1] || 0 : false;
}

function loadFile() {
    multipartFileClear();
    FILEREADER.readAsDataURL(FILESELECTOR[0].files[0]);
    FILEREADER.onloadend = processFileString;
}

function getFileName() {
    return FILENAME;
}

function processFileString() {
    FILEMIME = FILEREADER.result.split(",", 1)[0];

    FILENAME = FILESELECTOR[0].files[0].name;
    FILESTRING = cleanEncodeURI(Base64String.compressToUTF16(FILEREADER.result.split(",", 2)[1]));
    FILEHASH = CryptoJS.MD5(FILESTRING).toString();

    let baseUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    let basicUrl = baseUrl + "?m=" + encodeURIComponent(FILEMIME) + "&n=" + encodeURIComponent(FILENAME) + "&pl=";
    let multiPartStartBaseUrl = baseUrl + "?m=" + encodeURIComponent(FILEMIME) + "&h=" + encodeURIComponent(FILEHASH) + "&n=" + encodeURIComponent(FILENAME) + "&pt=0000";
    let multiPartUrl = baseUrl + "&p=0000&k=" + encodeURIComponent(FILEHASH);


    let basicUrlMode = false;

    if (basicUrl.length + FILESTRING.length <= MAXCHARS) {
        basicUrlMode = true;
    }

    if (basicUrlMode) {
        addUrl(basicUrl + FILESTRING);
    } else {

        const multiPartUrlLength = multiPartUrl.length + 4;
        const charsAfterFirstUrl = FILESTRING.length - (MAXCHARS - multiPartStartBaseUrl.length + 4);
        const totalUrlsRequired = Math.ceil(charsAfterFirstUrl / (MAXCHARS - multiPartUrlLength)) + 1;

        let fileStringPos;

        let url = multiPartStartBaseUrl.replace("0000", appendZeros(totalUrlsRequired));
        fileStringPos = MAXCHARS - (url.length + 4);
        url = url + "&mp=" + FILESTRING.substring(0, fileStringPos);


        let urls = new Array(url);
        let part = 2;

        while (fileStringPos < FILESTRING.length) {


            let partNo = appendZeros(part);

            let prevPos = fileStringPos;
            let url = window.location.protocol + "//" + window.location.host + window.location.pathname + "?p=" + partNo + "&k=" + FILEHASH.substring(0,4) + "&mp=";
            fileStringPos = fileStringPos + (MAXCHARS - url.length);

            url = url + FILESTRING.substring(prevPos, fileStringPos);
            urls.push(url);
            part += 1;
        }

        URLS = urls;
        userFileProcessCompleted(URLS);
    }
}

function cleanEncodeURI(base64Text) {
    let encodedStr = '', encodeChars = ["~", "!", "*", "(", ")", "'"];
    base64Text = encodeURIComponent(base64Text);

    for(let i = 0, len = base64Text.length; i < len; i++) {
        if (encodeChars.indexOf(base64Text[i]) >= 0) {
            let hex = parseInt(base64Text.charCodeAt(i)).toString(16);
            encodedStr += '%' + hex;
        }
        else {
            encodedStr += base64Text[i];
        }
    }
    return encodedStr;
}

function multipartFileProcessRegister() {
    const filename = decodeURIComponent(getQueryParam("n"));
    const mime = decodeURIComponent(getQueryParam("m"));
    const totalParts = parseInt(getQueryParam("pt"));
    const filehash = decodeURIComponent(getQueryParam('h'));

    localStorage.setItem("filename", filename);
    localStorage.setItem("mime", mime);
    localStorage.setItem("total_parts", totalParts);
    localStorage.setItem("file_part_0001", getQueryParam("mp"));
    localStorage.setItem("filehash", filehash)
    localStorage.setItem("fileKey", filehash.substring(0,4))
}

function multipartFileClear() {
    let arr = [];
    for (let i = 0; i < localStorage.length; i++){
        if (localStorage.key(i).substring(0,9) == 'file_part') {
            arr.push(localStorage.key(i));
        }
    }
    for (let i = 0; i < arr.length; i++) {
        localStorage.removeItem(arr[i]);
    }

    localStorage.removeItem("filename");
    localStorage.removeItem("mime");
    localStorage.removeItem("total_parts");
    localStorage.removeItem("filehash");
    localStorage.removeItem("fileKey");
}

function multipartFileProcessAdd() {
    if (localStorage.getItem('fileKey') === getQueryParam("k")) {
    localStorage.setItem("file_part_" + getQueryParam("p"), getQueryParam("mp"));
    return true;
    } else {
        return false;
    }
}

function detectTotalPartsCompleted() {

    let x = 1;
    let partsFound = [];
    const totalParts = parseInt(localStorage.getItem("total_parts"));

    while (x <= totalParts) {

        if (localStorage.getItem("file_part_" + appendZeros(x))) {
            partsFound.push(x);
        }
        x += 1;
    }

    if (partsFound.length === totalParts) {

        $("#fileCompleteMessage").text("Complete file found!");
        $("#fileFoundModal").modal("show");
        return true;

    } else {
        if (partsFound.length == 1) {
            $("#filePartMessage").text("First part found!");
        }
        else {
        $("#filePartMessage").text(partsFound.length + " parts found!"); }
    }
    if (partsFound.length < localStorage.getItem("total_parts")) {
        setTimeout(detectTotalPartsCompleted, 2000);
        return false;
    }
}

function appendZeros(partNo) {
    partNo = partNo.toString();

    while (partNo.length < 4) {
        partNo = "0" + partNo;
    }

    return partNo;
}


function assembleMultiPartFile() {
    let fileEncoded = "";
    const totalParts = localStorage.getItem("total_parts");
    const fileHash = decodeURIComponent(localStorage.getItem("filehash"));

    let i;
    for (i = 1; i <= totalParts; i++) {
        fileEncoded += localStorage.getItem("file_part_" + appendZeros(i));
    }

    const assembledHash = CryptoJS.MD5(fileEncoded).toString();

    if (assembledHash !== fileHash) {
        console.log("Assembled Hash: " + assembledHash);
        console.log("File Hash: " + fileHash);
        throw "Unable to verify file contents, aborting...";
    }

    let fileBlob = Base64String.decompressFromUTF16(decodeURIComponent(fileEncoded));
    fileBlob = decodeURIComponent(localStorage.getItem("mime")) + "," + fileBlob;

    saveAs(dataUrlToBlob(fileBlob), localStorage.getItem("filename"));
    multipartFileClear();
}


function loadSingleFileFromQueryParam() {
    const fileBlob = Base64String.decompressFromUTF16(decodeURIComponent(getQueryParam("pl")));
    const fileBase64 = decodeURIComponent(getQueryParam("m")) + "," + fileBlob;
    saveAs(dataUrlToBlob(fileBase64), getQueryParam("n"));
}


function dataUrlToBlob(dataUrl) {
    let array = dataUrl.split(",");
    let mimeType = array[0].match(/:(.*?);/)[1];
    let base64 = atob(array[1]);
    let x = base64.length;
    let uArray = new Uint8Array(x);

    while (x--) {
        uArray[x] = base64.charCodeAt(x);
    }

    return new Blob([uArray], {type: mimeType});
}

function calculateJSDate(epoch) {
    if (epoch < 9999999999) {
        epoch *= 1000;
    }
    epoch = epoch + (new Date().getTimezoneOffset() * -1);
    return new Date(epoch);
}

function getUrls() {
    return URLS;
}

function getShareUrlsLength() {
    return URLS.length;
}