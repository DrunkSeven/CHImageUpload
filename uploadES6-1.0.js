/**
 * 图片上传插件，多选和单选，可以选择先预览后上传或先上传后预览
 * 先传入父元素ID，默认为imgList
 * autoUpload为flase时，可以直接调用uploadFileEvent方法上传，也可以从file[]中取到待上传的文件，调用自己的ajax方法上传
 * autoUpload为true时，图片自动上传，不会显示上传按钮
 * selectImgEvent事件，图片选择之后触发，如果选择先预览后上传，上传事件可以写在selectImgEvent事件中，
 * 通过CHUpload.file获取到要上传的图片，要排除file.isOnline=true的文件，该类型文件是进入页面前上传过的文件
 * 9月19日：添加两个方法hideUpload()用于隐藏上传按钮，showUpload()显示上传按钮
 */
class CHUpload {
    constructor(data) {
        this.initData = {
            showUploadBtn: false, //是否显示默认的上传按钮
            boxId: 'imgList', //父元素容器
            autoUpload: false, //true自动上传
            selectMore: false, //true多图上传
            count: 0, //上传限制
            minHeight: 0, //高度最小像素
            minWidth: 0, //宽度最小像素
            previewWidth: 200, //预览尺寸宽度
            previewHeight: 150, //预览尺寸高度
            maxSize: 10, //单个文件大小限制
            allSize: 50, //文件总大小限制
            formData: {}, //自定义参数
            url: "", //上传路径
            bgText: "添加图片",
            uploadingText: "上传中",
            reUploadText: "重新上传",
        }
        for (let dataItem in data) {//将参数赋给initData，没有的用默认值
            this.initData[dataItem] = data[dataItem];
        }
        this.file = []; //要上传的文件
        this.fileSrc = []; //上传后后端返回的文件路径
        this.currentSize = 0; //当前选择的文件总大小
        this.uploadOneHtml = //上传单张图时显示的样式
            '<div class="preview-box" id="' + this.initData.boxId + 'previewBox">' +
            '   <input class="fileInput" accept="image/*" id="' + this.initData.boxId + 'fileInput" type="file">' +
            '   <div class="box-bg" id="' + this.initData.boxId + 'boxBg">' +
            '       <img src="./img/add_ic.png">' +
            '       <p class="bg-text">' + this.initData.bgText + '</p>' +
            '   </div>' +
            '   <img class="imgPreview" id="' + this.initData.boxId + 'imgPreview">' +
            '   <div class="reSelect" id="' + this.initData.boxId + 'reSelect" style="display: none">' +
            '       <p>' + this.initData.reUploadText + '</p>' +
            '   </div>' +
            (this.initData.uploadingText ? '<div class="uploading" style="display:none" id="' + this.initData.boxId + 'Uploading" ><div><img src="./img/loading.gif" /><p>' + this.initData.uploadingText + '</p></div></div>' : '') +
            '</div>';
        this.uploadBtnHtml = '<button class="uploadBtn" id="' + this.initData.boxId + 'uploadBtn">上传图片</button>'; //上传按钮样式
        this.uploadMoreHtml = //上传多张图显示的样式
            '<div class="previewListHtml" id="' + this.initData.boxId + 'previewListHtml">' +
            '<div class="preview-box" id="' + this.initData.boxId + 'previewBox">' +
            '   <input class="fileInput" accept="image/*" multiple="multiple" id="' + this.initData.boxId + 'fileInput" type="file">' +
            '<div class="box-bg">' +
            '<img src="./img/add_ic.png">' +
            '   <p class="bg-text">' + this.initData.bgText + '</p>',
            '</div>' +
            '</div></div>';
        this.box = document.getElementById(this.initData.boxId);
        this.box.innerHTML = '';
        if (this.initData.selectMore) {
            this.box.appendChild(this.parseHtml(this.uploadMoreHtml));
        } else {
            this.box.appendChild(this.parseHtml(this.uploadOneHtml));
        }
        if (!this.initData.autoUpload && this.initData.showUploadBtn) { //如果选择先预览后上传，可以通过控制showUploadBtn，决定是否显示默认的上传按钮，否则自定义上传按钮，通过调用uploadFile方法上传图片
            this.box.appendChild(this.parseHtml(this.uploadBtnHtml))
        }
        let previewBox = document.getElementById(this.initData.boxId + 'previewBox');
        previewBox.style.width = this.initData.previewWidth + 'px';
        previewBox.style.height = this.initData.previewHeight + 'px';
        document.getElementById(this.initData.boxId + 'fileInput').onchange = (event) => {
            this.selectImg(event);
        }
        var uploadBtn = document.getElementById(this.initData.boxId + 'uploadBtn');
        if (uploadBtn) {
            document.getElementById(this.initData.boxId + 'uploadBtn').onclick = (event) => {
                this.uploadFileEvent(function () { });
            };
        }
        this.selectImgEvent = function (flag, autoUpload) { }; //图片选择后触发
        this.uploadCompleteEvent = function (data, res) { }; //上传完成时触发
        this.deleteImgEvent = function () { }; //删除图片时触发
    }
    toString() {
        return JSON.stringify(this.data);
    }
    //选择图片
    selectImg(e) {
        let file = e.target.files;
        if (this.initData.count && this.file.length + file.length > this.initData.count) {
            this.tipMsg('请上传不超过' + this.initData.count + '张图片');
            return;
        }
        for (let i = 0; i < file.length; i++) {
            this.setImg(file[i], true, this.initData.autoUpload);
        };
    }
    //选择图片(file，是否验证,是否上传)
    setImg(file, validate, autoUpload) {
        if (this.initData.count && this.file.length >= this.initData.count) {
            this.tipMsg('请上传不超过' + this.initData.count + '张图片');
            return;
        }
        let _img = new Image(); //临时存放图片用来校验
        _img.src = window.URL.createObjectURL(file);
        _img.onload = () => {
            if (validate && !this.validate(file, _img)) {
                this.selectImgEvent(false, autoUpload);
                return;
            }
            if (!this.initData.selectMore) { //单选模式
                this.previewOneImg(window.URL.createObjectURL(file)); //显示预览图
                if (autoUpload) { //上传并预览
                    this.uploadFile(file);
                } else { //直接预览不上传
                    this.file = [];
                    this.file.push(file);
                }
            } else {
                file.timestamp = new Date().getTime(); //给图片添加一个时间戳
                let previewListHtml = document.getElementById(this.initData.boxId + 'previewListHtml');
                let imgMoreHtml = `<div class="preview-box" style="width:${this.initData.previewWidth}px;height:${this.initData.previewHeight}px;">
                <img src=${_img.src}>
                <p class="image-name">${file.name}</p>
                ${this.initData.uploadingText ? '<div id="uploading' + file.timestamp + '" style="display:none" class="uploading ' + this.initData.boxId + 'Uploading" ><div><img src="./img/loading.gif" /><p>' + this.initData.uploadingText + '</p></div></div>' : ''}
                <img id='${file.timestamp}' src='./img/close_ic.png' class='close'>
                </div>`
                previewListHtml.insertBefore(this.parseHtml(imgMoreHtml), previewListHtml.childNodes[0]);
                this.file.unshift(file);
                this.currentSize += file.size;
                if (autoUpload) { //上传并预览
                    this.uploadFile(file);
                }
                document.getElementById(file.timestamp.toString()).addEventListener('click', () => {
                    this.deleteImg(file.timestamp);
                });
            }
            document.getElementById(this.initData.boxId + 'fileInput').value = '';
            this.selectImgEvent(true, autoUpload);
        }
    }
    //验证图片是否符合要求
    validate(file, img) {
        let state = true;
        if (this.initData.allSize && this.currentSize + file.size > this.initData.allSize * 1024 * 1024) {
            this.tipMsg('图片总大小超过' + this.initData.allSize + 'M');
            state = false;
        } else if (file.size > this.initData.maxSize * 1024 * 1024) {
            this.tipMsg('请上传小于' + this.initData.maxSize + 'M的图片');
            state = false;
        } else if ((this.initData.minHeight && img.height < this.initData.minHeight) || (this.initData.minWidth && img.width <
            this.initData.minWidth)) {
            this.tipMsg('图片尺寸不符合要求');
            state = false;
        }
        return state;
    }
    deleteImg(timestamp) {
        let files = this.file;
        let fileSrc = this.fileSrc;
        for (let i = 0; i < files.length; i++) {
            if (files[i].timestamp == timestamp) {
                this.currentSize -= files[i].size;
                files.splice(i, 1);
                this.initData.selectMore ? fileSrc.splice(i, 1) : this.fileSrc = '';
                let previewBox = document.getElementById(this.initData.boxId + 'previewListHtml').childNodes[i];
                document.getElementById(this.initData.boxId + 'previewListHtml').removeChild(previewBox);
            }
        }
        this.deleteImgEvent();
    }

    previewOneImg(url) {
        let img = document.getElementById(this.initData.boxId + 'imgPreview');
        img.src = url;
        this.fileSrc = url;
        document.getElementById(this.initData.boxId + 'reSelect').style.display = 'flex';
        document.getElementById(this.initData.boxId + 'boxBg').style.display = 'none';
    }

    //开始上传
    uploadFile(files) {
        if (files.isOnline) { //如果是用户之前上传的图片，则不需要再上传
            return;
        }
        let formData = new FormData();
        if (files.timestamp) {
            document.getElementById('uploading' + files.timestamp).style.display = "flex";
        } else if (!this.initData.selectMore) {
            document.getElementById(this.initData.boxId + 'Uploading').style.display = "flex";
        }
        for (let item in this.initData.formData) { //将参数赋给initData，没有的用默认值
            if (this.initData.formData[item])
                formData.append(item, this.initData.formData[item]);
        }
        formData.append('file', files);
        let request = new XMLHttpRequest();
        request.open('POST', this.initData.url);
        request.send(formData);
        request.onreadystatechange = () => {
            if (request.readyState === 4) {
                if (files.timestamp) {
                    document.getElementById('uploading' + files.timestamp).style.display = "none";
                } else if (!this.initData.selectMore) {
                    document.getElementById(this.initData.boxId + 'Uploading').style.display = "none";
                }
                // if (!request) {
                //     this.tipMsg('上传成功');
                //     this.initData.selectMore ? this.fileSrc.unshift(g_object_name) : this.fileSrc = g_object_name;
                // } else if (request.flag) {
                //     this.initData.selectMore ? this.fileSrc.unshift(request.rs[0]) : this.fileSrc = request.rs[0];
                // } else {
                //     this.deleteImg(files.timestamp)
                //     this.tipMsg(request.msg);
                // }
                this.uploadCompleteEvent(this.fileSrc, JSON.parse(request.response));
            }
        }
        // $.ajax({
        //     url: this.initData.url,
        //     type: 'POST',
        //     data: formData,
        //     processData: false,
        //     contentType: false,
        //     success: (res) => {
        //         if (files.timestamp) {
        //             document.getElementById('uploading' + files.timestamp).style.display = "none";
        //         } else if (!this.initData.selectMore) {
        //             document.getElementById(this.initData.boxId + 'Uploading').style.display = "none";
        //         }
        //         if (!res) {
        //             this.tipMsg('上传成功');
        //             this.initData.selectMore ? this.fileSrc.unshift(g_object_name) : this.fileSrc = g_object_name;
        //         } else if (res.flag) {
        //             this.initData.selectMore ? this.fileSrc.unshift(res.rs[0]) : this.fileSrc = res.rs[0];
        //         } else {
        //             this.deleteImg(files.timestamp)
        //             this.tipMsg(res.msg);
        //         }
        //         this.uploadCompleteEvent(this.fileSrc, res);
        //     }
        // });
    }
    //提示框
    tipMsg(text) {
        let div1 = document.createElement('div');
        let div2 = document.createElement('div');
        div1.style.position = "fixed";
        div1.style.width = '100%';
        div1.style.top = '50%';
        div1.style.left = '0';
        div1.style.right = '0';
        div1.style.margin = 'auto';
        div1.style.maxWidth = "200px";
        div1.style.textAlign = 'center';
        div1.style.animation = 'showMsg .5';
        div2.style.margin = 'auto';
        div2.style.left = '0';
        div2.style.right = '0';
        div2.style.top = '0';
        div2.style.bottom = '0';
        div2.style.padding = '5px';
        div2.style.borderRadius = '5px';
        div2.style.background = '#666';
        div2.style.fontSize = '16px';
        div2.style.color = '#fff';
        div2.innerText = text;
        div1.appendChild(div2);
        document.body.appendChild(div1);
        setTimeout(function () {
            document.body.removeChild(div1);
        }, 2000);
    }
    addImgByUrl(url, name, thumbnailImgUrl, id, value, size) {
        let timestamp = new Date().getTime();
        if (!this.initData.selectMore) { //单选模式
            this.previewOneImg(thumbnailImgUrl || url); //显示预览图
            this.fileSrc = url;
        } else {
            let previewListHtml = document.getElementById(this.initData.boxId + 'previewListHtml');
            let imgMoreHtml = `<div ${value != undefined ? "value=" + value : ''} ${id ? "id=" + id : ''} class="preview-box" style="width:${this.initData.previewWidth}px;height:${this.initData.previewHeight}px;">
            <img src=${thumbnailImgUrl || url}>
            <p class="image-name">${name}</p>
            ${this.initData.uploadingText ? '<div id="uploading' + timestamp + '" style="display:none" class="uploading ' + this.initData.boxId + 'Uploading" ><div><img src="./img/loading.gif" /><p>' + this.initData.uploadingText + '</p></div></div>' : ''}
            <img id='${timestamp}' src='./img/close_ic.png' class='close'>
            </div>`
            previewListHtml.insertBefore(this.parseHtml(imgMoreHtml), previewListHtml.childNodes[0]);
            this.file.unshift({
                url: url,
                timestamp: timestamp,
                isOnline: true
            })
            this.fileSrc.unshift(url);
        }
        $('#' + timestamp).click(() => {
            this.deleteImg(timestamp);
        })
        this.selectImgEvent(true, this.initData.autoUpload);
        this.currentSize += size ? size : 0;
    }
    parseHtml(arg) {
        let objE = document.createElement("div");
        objE.innerHTML = arg;
        return objE.childNodes[0];
    }
    hideUpload() {
        if (!this.initData.selectMore) {
            document.getElementById(this.initData.boxId + 'previewBox').style.cursor = 'default';
            document.getElementById(this.initData.boxId + 'fileInput').style.display = 'none';
            document.getElementById(this.initData.boxId + 'reSelect').style.display = 'none';
        } else {
            document.getElementById(this.initData.boxId + 'previewBox').style.display = 'none';
        }
    }
    showUpload() {
        if (!this.initData.selectMore) {
            document.getElementById(this.initData.boxId + 'previewBox').style.cursor = 'pointer';
            document.getElementById(this.initData.boxId + 'fileInput').style.display = '';
            document.getElementById(this.initData.boxId + 'reSelect').style.display = '';
        } else {
            document.getElementById(this.initData.boxId + 'previewBox').style.display = '';
        }
    }
}