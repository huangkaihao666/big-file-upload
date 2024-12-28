---
theme: smartblue
---

## 前言

在现代网络环境中，用户上传大文件的需求越来越普遍，尤其是在云存储、视频分享、在线教育等领域。然而，大文件上传过程中的网络波动、不稳定性，以及客户端资源的限制，常常给用户带来不佳的体验。传统的整文件上传方式不仅容易因中断而失败，还可能占用大量内存和带宽资源，对用户设备和服务器都造成负担。

为了解决这些问题，分片上传（Chunked Upload）和断点续传（Resumable Upload）技术应运而生。它们通过将大文件拆分为多个小块逐一上传，并在中断后支持续传，显著提高了上传效率和可靠性。本篇博客将详细解析分片上传的基本原理和实现方法，从前端的文件分片、上传逻辑，到后端的文件接收与合并，并结合实践案例，分享如何实现断点续传功能，以及提升用户体验的优化策略。

如果你也正在寻找一种更优雅、高效的方式解决大文件上传问题，那么这篇文章将带你从理论到实践，深入了解分片上传的实现全过程。包括对背景分析、流程图解、测试图解和代码提供的讲解，希望能对您有所帮助

## 背景

### 大文件上传的挑战与痛点

*   **网络中断风险**\
    上传过程中网络不稳定或意外中断会导致整个上传任务失败，用户需要从头开始重新上传，浪费时间和带宽。

*   **客户端资源消耗**\
    大文件上传会占用大量内存和带宽资源，尤其在低配置设备（如移动设备）上，容易导致设备卡顿或资源耗尽。

*   **服务器负担**\
    如果没有有效的分片管理和断点续传机制，大文件上传失败后，服务器会存储许多不完整或重复的文件，浪费存储资源并增加维护难度。

*   **用户体验不佳**\
    上传过程中缺乏实时反馈（如进度条），或者因为频繁失败而无法继续上传，会严重影响用户的满意度和使用意愿。

### 分片上传的优势

为了解决上述问题，分片上传技术提出了一种更高效的文件传输方式，即`将大文件切割成多个小块（Chunk），逐一上传并在服务器端合并`。与传统整文件上传相比，分片上传具有以下显著优势：

1.  **节约内存资源**\
    每次只需读取并上传一个分片，无需将整个文件加载到内存中，有效减少客户端和服务器的内存消耗，适合在移动端等低内存环境中使用。
2.  **支持断点续传**\
    分片上传可以`记录已成功上传的分片信息`。如果上传中断，只需重新上传未完成的分片，而无需从头开始，极大地提高了上传的可靠性。
3.  **提升上传速度与效率**\
    通过设置合理的分片大小和并发上传，分片上传能够充分利用网络带宽，提升整体传输效率。例如，通过多线程上传多个分片，可以实现比传统单线程上传更快的速度。
4.  **优化用户体验**\
    分片上传允许`实现实时的进度显示`，并通过`重试机制处理上传失败的分片`，从而提升用户对上传过程的可控性和满意度。

分片上传的这些优势不仅解决了大文件上传的传统痛点，还为提升上传体验和可靠性提供了强有力的技术支持，因此被广泛应用于各类文件上传场景中。

## 文件分片原理

### 大文件拆分为小块（Chunk）的方式

文件分片是实现分片上传的核心步骤，其主要目标是将大文件拆分成多个小块（Chunk），以便逐一上传到服务器，最终在服务器端进行合并。

**文件分片的基础技术**

*   使用浏览器提供的 `File` 对象和 `Blob` 对象的 `slice` 方法，可以将文件按指定大小分割成多个块。
*   每个分片包含文件的一部分数据，并可以通过偏移量（`start` 和 `end`）定义其内容范围。

```js
// 文件分片
function splitFile(file, chunkSize) {
    const chunks = [];
    let start = 0;
    while (start < file.size) {
        const end = Math.min(start + chunkSize, file.size);
        chunks.push(file.slice(start, end));
        start = end;
    }
    return chunks;
}

```

**分片的标识与管理**

*   `每个分片通常分配一个唯一标识（如序号或哈希值）`，以便前后端协作追踪上传状态和重建文件。
*   还需`记录每个分片的大小和偏移量`，以确保数据的完整性和正确合并。

#### **分片大小的选择策略与适配性分析**

分片大小的选择直接影响上传性能和系统资源使用，应根据以下因素进行调整：

1.  **文件大小**

    *   对小文件，分片大小应较小，以避免分片过多带来的管理开销。
    *   对超大文件，分片大小可适当增大，以减少上传的分片总数。

2.  **网络带宽与稳定性**

    *   在带宽充足且稳定的网络环境下，可选择较大的分片，以提高传输效率。
    *   在网络波动较大时，较小的分片有助于减少失败后的重传成本。

3.  **服务器存储限制**

    *   服务器需要暂存所有分片，在选择分片大小时应考虑服务器的存储能力，以避免因分片过大而导致存储不足。

4.  **适配性分析**

    *   一般来说，分片大小可设置为 1MB\~10MB，但具体大小应通过测试决定，以在上传速度和系统负载之间取得平衡。

## 断点续传原理

断点续传是`在分片上传基础上实现`的功能，旨在`处理因网络中断、意外错误等原因导致的上传中断问题`，从而提升上传可靠性。

#### **前端如何追踪已上传分片？**

1.  **上传记录管理**

    *   前端通过`查询服务器接口，获取已上传分片的列表`，通常包括分片序号或偏移量等信息。
    *   在`每次上传分片前，检查该分片是否已上传`，避免重复上传。

```js
// 追踪已上传分片
async function getUploadedChunks(fileHash) {
    const response = await fetch(`/upload/status?fileHash=${fileHash}`);
    return response.json(); // 返回已上传的分片列表
}

```

2.  **动态调整上传逻辑**

    *   根据服务器返回的状态，`只上传未完成的分片`，节约时间和带宽。
    *   对于部分`上传失败的分片`，可通过`重试机制`重新上传。

#### **后端如何记录和验证上传状态？**

1.  **分片状态存储**

    *   服务器需`为每个上传的文件创建一个记录，存储文件标识（如文件哈希值）和已上传的分片信息（如分片序号）`。
    *   常用的存储方式包括数据库、缓存（如 Redis）或文件系统。

示例记录格式：

```js

{
    "fileHash": "abcdef123456",
    "uploadedChunks": [0, 1, 2, 4] // 已上传的分片序号
}

```

2.  **上传状态验证**

    *   每次接收到新的分片时，验证分片序号和文件标识，防止重复或非法上传。
    *   确认所有分片上传完成后，才进行文件合并操作。

#### **利用文件哈希值确保文件唯一性**

文件哈希值（如 MD5、SHA256）是实现文件唯一性的重要手段，具体应用如下：

1.  **文件唯一标识**

    *   前端通过计算文件的哈希值，将其作为文件的唯一标识，`用于分片上传和合并时的身份验证`。
    *   `同一文件上传多次时，服务器可通过哈希值识别文件并跳过重复上传`。

    示例哈希计算：

```js

async function calculateFileHash(file) {
    const chunkSize = 10 * 1024 * 1024; // 每次读取10MB
    const chunks = [];
    for (let i = 0; i < file.size; i += chunkSize) {
        const chunk = file.slice(i, i + chunkSize);
        chunks.push(await chunk.arrayBuffer());
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Blob(chunks));
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

```

2.  **文件合并校验**

    *   在合并分片后，服务器重新计算完整文件的哈希值，与上传时的哈希值进行比对，确保文件完整性和一致性。
    *   如果校验失败，可重新触发合并或请求用户重新上传相关分片。

通过文件分片、状态追踪和哈希校验的组合，分片上传和断点续传能够高效且可靠地解决大文件上传的各种问题，为用户提供流畅的文件上传体验。

## 补充理解

在断点续传的场景下，`服务器需要区分上传的分片属于哪个文件以及文件的完整性校验`。这涉及以下几个关键点：

### **1. 文件标识：利用文件哈希值区分文件**

文件哈希值通常基于整个文件计算，用于标识一个文件的唯一性。对于断点续传，服务器会记录以下信息：

*   **文件的整体哈希值**（预先由客户端提供）。
*   **已上传分片的清单**，包括分片的序号或偏移量。

这确保了每次新上传的分片可以正确关联到目标文件，即使用户在多次上传中途暂停，也能通过文件哈希值和记录清单恢复上传进度。

### **2. 未完整上传的文件校验机制**

#### **(1) 未完整文件的区分：不依赖完整哈希校验**

当`文件只上传了一部分时`：

*   无法直接计算并匹配整个文件的哈希值，因为文件尚未完整。
*   此时，`客户端不会执行整体文件哈希校验，而是依赖分片序号和文件的唯一标识（如文件名+整体哈希）`。

#### **(2) 上传时服务器存储的内容**

对于断点续传，服务器应维护如下信息：

*   **文件哈希值**：客户端上传时提供的整体文件哈希值，用于最终校验完整性。
*   **已上传分片的列表**：记录分片序号或分片范围（如 `[0-5MB, 5-10MB]`）。
*   **分片的临时存储路径**：每个分片文件单独保存，避免覆盖和冲突。

例如，服务器保存的状态可能如下：

```js

{
    "fileHash": "abcdef123456",
    "uploadedChunks": [0, 1, 2],
    "totalChunks": 10,
    "chunkSize": 5 * 1024 * 1024 // 每个分片5MB
}

```

#### **(3) 客户端恢复时的流程**

*   客户端请求上传状态：发送 `fileHash` 查询服务器。
*   服务器返回已上传的分片信息。
*   客户端根据响应调整上传逻辑，跳过已上传分片，仅继续上传未完成部分。

### **3. 总结：如何区分部分文件与文件整体？**

*   **整体哈希值（fileHash）** ：用于唯一标识文件，在`上传初始阶段由客户端提供`。
*   **分片记录**：服务器以分片序号和 `fileHash` 为依据，跟踪断点续传的进度。
*   **分片临时存储**：`各分片单独存储，上传完成后再合并成完整文件`。
*   **最终哈希校验**：上传完成后，`服务器重新计算文件哈希值`，确保与 `fileHash` 一致。

通过这种方式，服务器可以有效管理部分上传的文件，并在后续操作中准确区分它们的来源和状态。

## 前端实现思路

### 实现文件分片与上传

小编使用原生`JavaScript`讲解一下主要的实现思路，后面有完整的代码实现，小编把仓库地址贴在最后，感兴趣的小伙伴可以下载食用

**1. 文件分片：** 使用 HTML5 的 `File` 和 `Blob` 接口对文件进行分片处理。

```js

const chunkSize = 512 * 1024; // 每片 512KB
const chunks = Math.ceil(file.size / chunkSize);
const chunk = file.slice(start, end);

```

通过 `slice` 方法将文件划分成多个小片段。

**2. 文件唯一标识：** 利用文件的名称与大小对整个文件生成一个哈希值（伪 MD5）,可以借助第三方库实现MD5生成哈，小编这里简单表示一下：

```js

async function calculateHash(file) {
    return `${file.name}-${file.size}`;
}

```

后端利用该哈希值作为分片目录名，确保唯一性。

### 实现断点续传

**1. 获取已上传分片：** 前端通过 `/uploaded-chunks` 接口查询服务器已上传的分片信息：

```js

async function getUploadedChunks(fileHash) {
    const response = await fetch(`${API_BASE_URL}/uploaded-chunks?hash=${fileHash}`);
    return response.ok ? await response.json() : [];
}

```

**2. 跳过已上传部分：** 通过比较服务器返回的分片索引列表，跳过这些分片，提高上传效率：

```js

const uploadedChunks = await getUploadedChunks(fileHash);
for (let i = 0; i < chunks; i++) {
    if (uploadedChunks.includes(i)) continue;
    // 上传剩余分片...
}

```

### 进度条与用户体验优化

**1. 实时进度更新：** 利用分片上传的累计大小更新进度条：

```js

const progress = Math.round((uploadedSize / file.size) * 100);
const speed = (uploadedSize / (Date.now() - startTime)) * 1000; // 计算速度
updateStatus(progress, formatSpeed(speed), `上传进度：${progress}%`);

```

**2. 网络状态监听：** 通过 `online` 和 `offline` 事件监听网络变化，断网时自动暂停上传，恢复时提示用户继续：

```js

window.addEventListener('offline', () => {
    if (isUploading) controller.abort();
    updateStatus(progress, '', '网络断开，上传已暂停', true);
});
window.addEventListener('online', () => {
    updateStatus(progress, '', '网络恢复，您可以重新开始上传');
});

```

### 错误处理与重试机制

**分片上传失败处理：** 通过循环和延时机制实现上传失败的自动重试：

```js

async function uploadChunk(formData, retryCount = 3) {
    for (let i = 0; i < retryCount; i++) {
        try {
            const response = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
            if (response.ok) return response;
        } catch (err) {
            if (i === retryCount - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

```

## 后端实现思路

### 实现分片上传处理

**1. 分片接收：** 使用 `Multer` 中间件接收分片文件，并将其存储在临时目录中：

```js

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { hash, chunkIndex } = req.body; // 获取分片唯一标识和分片编号
        const chunksDir = path.join(__dirname, 'uploads_temp', hash); // 基于文件哈希创建分片存储目录

        // 如果目录不存在，则创建目录
        try {
            await fsPromises.access(chunksDir); // 检查目录是否存在
        } catch {
            await fsPromises.mkdir(chunksDir, { recursive: true }); // 创建存储目录
        }

        // 保存分片到指定位置
        const chunkPath = path.join(chunksDir, chunkIndex);
        await fsPromises.rename(req.file.path, chunkPath); // 将临时文件移动到分片目录
        console.log('分片保存成功:', chunkPath);

        res.json({ success: true });
    } catch (error) {
        console.error('上传处理错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

```

**2. 高效存储分片：** 利用 `fsPromises.mkdir` 创建基于哈希值的临时目录，将分片存储在该目录下。

```js

await fsPromises.mkdir(uploadDir, { recursive: true });

```

### 实现文件合并与校验

**1. 合并流程：** 按分片索引顺序读取分片文件并合并到目标文件：

```js

const sortedChunks = chunks.sort((a, b) => a - b);
const writeStream = fs.createWriteStream(filePath);
for (const chunk of sortedChunks) {
    const chunkData = await fsPromises.readFile(chunkPath);
    writeStream.write(chunkData);
}
writeStream.end();

```

**2. 临时目录清理：** 合并后异步删除分片目录，释放存储空间：

```js

await rimraf(chunksDir, { force: true });

```

### 支持断点续传

**1. 已上传分片查询接口：** 返回分片目录中的文件名，表示已上传的分片索引：

```js

app.get('/uploaded-chunks', async (req, res) => {
    const { hash } = req.query; // 文件唯一标识
    const chunksDir = path.join(__dirname, 'uploads_temp', hash); // 根据哈希计算目录路径

    try {
        // 读取分片目录中的文件名列表
        const files = await fsPromises.readdir(chunksDir);
        const uploadedChunks = files.map(file => parseInt(file, 10)); // 转换为数字形式
        res.json(uploadedChunks); // 返回已上传的分片编号
    } catch (err) {
        console.error('获取已上传分片失败:', err);
        res.json([]); // 如果发生错误，返回空数组
    }
});

```

**2. 存储分片信息：** 后端通过目录结构和分片文件名记录上传状态，避免额外的数据库开销。

存储原理说明：

**目录结构**：

*   分片文件存储在 `uploads_temp` 目录下。
*   每个文件的分片以 `文件哈希值` 为目录名，区分不同文件的分片数据。
*   分片文件名为其对应的分片编号（如 `0`, `1`, `2` 等）。

示例路径：`假设文件哈希为文件名+文件大小`，这是小编上面示例代码的实现方法，则结果如下：

<p align="center"><img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/864c32f2e00f49c099eb102c8618dd8b~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg5oC75piv552h5LiN5aSf:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjU3MTEzMTIzMTE1MDQ4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1735980299&x-orig-sign=suKblK5RdUXVapmyvufWE3MyiyU%3D" alt="微信图片_20241228130704.png" width="90%"></p>

**优势**：

*   不需要额外的数据库存储。
*   通过文件系统即可快速获取已上传分片的信息。
*   目录结构直观，便于调试和管理。

### 流程图解析

<p align="center"><img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/59f4c70d695848828fef1a06e7417e63~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg5oC75piv552h5LiN5aSf:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjU3MTEzMTIzMTE1MDQ4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1735980299&x-orig-sign=GCDWuX9CvelGCuai%2FHaEgKiBteo%3D" alt="微信图片_20241228142542.png" width="90%"></p>

以上仅仅是个人理解，如果错误还希望各位好朋友纠正一下谢谢，防止小编的理解对初学者产生误导

### 流程图解测试

`上传过程：`

<p align="center"><img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/ae529d2f467c4e21be96c61aa81fa75e~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg5oC75piv552h5LiN5aSf:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjU3MTEzMTIzMTE1MDQ4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1735980299&x-orig-sign=vtlr5noryL4jE%2BFIfHET%2FjZOlYY%3D" alt="微信图片_20241228143700.png" width="90%"></p>

`查看服务端保存的已上传分片信息：`

<p align="center"><img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/0c1af542c77546eaa792e71fda6667a1~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg5oC75piv552h5LiN5aSf:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjU3MTEzMTIzMTE1MDQ4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1735980299&x-orig-sign=cp6D%2FMaM5iIcob74163eaGEJ97w%3D" alt="微信图片_20241228143812.png" width="90%"></p>

`断网离线测试：（进度条可以看到暂停在当前的上传进度）`

<p align="center"><img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/f6ce550163104ad3a6968f7456ce190f~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg5oC75piv552h5LiN5aSf:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjU3MTEzMTIzMTE1MDQ4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1735980299&x-orig-sign=SzTFKUdcp1WTT7IJYXZ%2BqI8l2r0%3D" alt="微信图片_20241228143900.png" width="90%"></p>

`网络恢复，断点续传测试：（进度条在刚刚上传的进度上增加，已上传的分片不会继续上传）`

<p align="center"><img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/e95e8f3cc9b4443ab4b0f17430c78bba~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg5oC75piv552h5LiN5aSf:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjU3MTEzMTIzMTE1MDQ4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1735980299&x-orig-sign=lfxEWs0UWQO7zB9Kg7ZFnKK3BpU%3D" alt="微信图片_20241228144000.png" width="90%"></p>

`上传成功：`

<p align="center"><img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/dd215e63b475462da6fd3e95d81e7612~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg5oC75piv552h5LiN5aSf:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjU3MTEzMTIzMTE1MDQ4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1735980299&x-orig-sign=gixJ%2BqzjU1%2FoO%2F5dGOKg3TfXG9E%3D" alt="微信图片_20241228144143.png" width="90%"></p>

### 完整代码

`前端：`

```js
<!DOCTYPE html>
<html>
<head>
    <title>大文件上传</title>
    <meta charset="utf-8">
    <link rel="stylesheet" href="./index.css">
</head>
<body>
    <div class="file-input-container">
        <!-- 文件选择输入框 -->
        <input type="file" id="fileInput">
        <!-- 上传按钮 -->
        <button id="uploadButton" class="upload-button" onclick="uploadFile()">上传文件</button>
        <!-- 取消按钮 -->
        <button id="cancelButton" class="upload-button" onclick="cancelUpload()" style="background-color: #f44336; margin-left: 10px;" disabled>取消上传</button>
    </div>
    <div class="progress-container">
        <!-- 进度条 -->
        <div class="progress-bar">
            <div class="progress-bar-inner" id="progressBar"></div>
        </div>
        <!-- 上传进度文本 -->
        <div class="progress-text" id="progress">等待上传...</div>
        <!-- 上传速度显示 -->
        <div class="upload-speed" id="speedText"></div>
        <!-- 错误信息显示 -->
        <div class="error-text" id="errorText"></div>
        <!-- 已上传的分片信息 -->
        <div class="uploaded-chunks" id="uploadedChunks">已上传分片: 无</div>
    </div>

    <script>
        const API_BASE_URL = location.protocol + '//' + location.hostname + ':9999';  // API 地址
        const chunkSize = 512 * 1024; // 每个分片大小为 512KB
        let isUploading = false; // 标记是否正在上传
        let controller = null; // 用于取消上传的控制器
        let uploadedSize = 0; // 已上传的字节数
        let file = null; // 当前上传的文件对象

        // 检查服务器是否可用
        async function checkServer() {
            try {
                const response = await fetch(API_BASE_URL, { method: 'GET' });
                return response.ok; // 如果服务器正常响应，返回 true
            } catch (err) {
                console.error('服务器连接失败:', err);
                return false; // 连接失败返回 false
            }
        }

        // 更新页面上的状态信息
        function updateStatus(progress, speed, message, error = false) {
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progress');
            const speedText = document.getElementById('speedText');
            const errorText = document.getElementById('errorText');

            progressBar.style.width = `${progress}%`;  // 更新进度条宽度
            progressText.innerText = progress === 100 ? "上传完成！" : `上传进度：${progress}%`; // 更新进度文本
            speedText.innerText = speed || '';  // 显示上传速度
            errorText.innerText = error ? message : '';  // 显示错误信息

            // 如果上传出错，进度文本显示为红色
            if (error) {
                progressText.style.color = '#f44336';
            } else {
                progressText.style.color = '#333';  // 否则为默认颜色
            }
        }

        // 上传文件的主函数
        async function uploadFile() {
            if (isUploading) return;  // 如果文件正在上传，跳过

            const serverAvailable = await checkServer();  // 检查服务器是否可用
            if (!serverAvailable) {
                updateStatus(0, '', '无法连接到上传服务器，请确保服务器已启动 (npm start)', true);
                return;
            }

            file = document.getElementById('fileInput').files[0];  // 获取文件
            if (!file) {
                updateStatus(0, '', '请选择文件', true);  // 如果未选择文件，提示
                return;
            }

            const uploadButton = document.getElementById('uploadButton');
            const cancelButton = document.getElementById('cancelButton');
            uploadButton.disabled = true;  // 禁用上传按钮
            cancelButton.disabled = false;  // 启用取消按钮
            isUploading = true;  // 设置上传标志
            controller = new AbortController();  // 创建一个取消控制器

            try {
                const fileHash = await calculateHash(file);  // 计算文件的哈希值
                const uploadedChunks = await getUploadedChunks(fileHash);  // 获取已上传的分片信息
                document.getElementById('uploadedChunks').innerText = `已上传分片: ${uploadedChunks.join(', ') || '无'}`;

                const chunks = Math.ceil(file.size / chunkSize);  // 计算文件需要多少个分片
                uploadedSize = uploadedChunks.reduce((acc, index) => acc + Math.min(chunkSize, file.size - index * chunkSize), 0);  // 已上传的字节数
                let startTime = Date.now();  // 上传开始时间
                let lastUpdate = startTime;  // 上一次更新的时间

                updateStatus(0, '', '准备上传...');  // 更新状态为准备上传

                // 上传所有分片
                const uploadPromises = [];
                for (let i = 0; i < chunks; i++) {
                    if (uploadedChunks.includes(i)) continue;  // 如果该分片已上传，则跳过

                    const start = i * chunkSize;  // 当前分片的起始位置
                    const end = Math.min(file.size, start + chunkSize);  // 当前分片的结束位置
                    const chunk = file.slice(start, end);  // 切割出当前分片

                    const formData = new FormData();
                    formData.append('file', chunk);  // 添加文件分片
                    formData.append('hash', fileHash);  // 添加文件的哈希值
                    formData.append('chunkIndex', i);  // 添加当前分片的索引
                    formData.append('chunks', chunks);  // 添加总分片数
                    formData.append('filename', file.name);  // 添加文件名

                    // 通过 Promise 上传当前分片
                    uploadPromises.push(uploadChunk(formData).then(() => {
                        uploadedSize += chunk.size;  // 更新已上传的字节数
                        const progress = Math.round((uploadedSize / file.size) * 100);  // 计算上传进度
                        const now = Date.now();
                        let speedText = '';

                        if (now - lastUpdate > 100) {  // 每隔 100ms 更新上传速度
                            const speed = (uploadedSize / (now - startTime)) * 1000;  // 计算上传速度 (字节/秒)
                            speedText = `上传速度: ${formatSpeed(speed)}`;  // 格式化速度
                            lastUpdate = now;
                        }

                        updateStatus(progress, speedText, `上传进度：${progress}%`);  // 更新上传状态
                    }));
                }

                await Promise.all(uploadPromises);  // 等待所有分片上传完成

                // 合并文件
                const mergeResponse = await fetch(`${API_BASE_URL}/merge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: file.name, hash: fileHash }),  // 传递文件名和哈希值
                    signal: controller.signal
                });

                if (!mergeResponse.ok) {
                    throw new Error('文件合并失败');  // 合并失败时抛出错误
                }

                const totalTime = formatTime(Date.now() - startTime);  // 计算总上传时间
                updateStatus(100, `总用时: ${totalTime}`, '上传完成！');  // 上传完成状态
            } catch (err) {
                if (err.name !== 'AbortError') {  // 如果是取消上传的错误，忽略
                    console.error('上传错误:', err);
                    updateStatus(0, '', err.message, true);  // 显示错误信息
                }
            } finally {
                isUploading = false;  // 结束上传标志
                uploadButton.disabled = false;  // 启用上传按钮
                cancelButton.disabled = true;  // 禁用取消按钮
                controller = null;  // 清除控制器
            }
        }

        // 取消上传操作
        function cancelUpload() {
            if (controller) {
                controller.abort();  // 取消上传
                isUploading = false;  // 停止上传标志
                document.getElementById('uploadButton').disabled = false;  // 启用上传按钮
                document.getElementById('cancelButton').disabled = true;  // 禁用取消按钮

                // 保留当前上传进度并显示取消提示
                const progress = Math.round((uploadedSize / file.size) * 100);
                updateStatus(progress, '', '上传已取消', true);
            }
        }

        // 上传单个分片并处理重试
        async function uploadChunk(formData, retryCount = 3) {
            for (let i = 0; i < retryCount; i++) {
                try {
                    const response = await fetch(`${API_BASE_URL}/upload`, {
                        method: 'POST',
                        body: formData,
                        signal: controller.signal
                    });

                    if (!response.ok) {
                        throw new Error(`上传失败: ${response.status}`);  // 上传失败时抛出错误
                    }
                    return response;  // 上传成功返回响应
                } catch (err) {
                    if (err.name === 'AbortError') throw err;  // 如果是取消操作，则抛出
                    if (i === retryCount - 1) throw err;  // 如果尝试次数耗尽，则抛出
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));  // 等待重试
                }
            }
        }

        // 获取已上传的分片信息
        async function getUploadedChunks(fileHash) {
            try {
                const response = await fetch(`${API_BASE_URL}/uploaded-chunks?hash=${fileHash}`);
                if (response.ok) return await response.json();  // 返回已上传的分片数组
            } catch (err) {
                console.error('获取已上传分片失败:', err);
            }
            return [];  // 如果请求失败，返回空数组
        }

        // 格式化上传速度
        function formatSpeed(bytesPerSecond) {
            if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(1)} B/s`;
            if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
            return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
        }

        // 格式化上传时间
        function formatTime(ms) {
            if (ms < 1000) return `${ms}毫秒`;
            if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
            const minutes = Math.floor(ms / 60000);
            const seconds = ((ms % 60000) / 1000).toFixed(1);
            return `${minutes}分${seconds}秒`;
        }

        // 计算文件的哈希值（这里只是返回文件名和文件大小）
        async function calculateHash(file) {
            return `${file.name}-${file.size}`;
        }

        // 提示离开页面时阻止上传
        window.addEventListener('beforeunload', (event) => {
            if (isUploading) {
                event.preventDefault();
                event.returnValue = '文件正在上传，确定要离开吗？';  // 提示用户确认是否离开
            }
        });

        // 在顶层变量中增加断网提示标志
        let networkPaused = false;

        // 监听断网事件
        window.addEventListener('offline', () => {
            if (isUploading && !networkPaused) { // 确保断网提示只显示一次
                controller.abort(); // 停止上传
                isUploading = false; // 停止上传标记
                networkPaused = true; // 标记断网状态
                document.getElementById('uploadButton').disabled = false;
                document.getElementById('cancelButton').disabled = true;

                // 保留当前进度并显示断网提示
                const progress = Math.round((uploadedSize / file.size) * 100);
                updateStatus(progress, '', '网络断开，上传已暂停', true);
            }
        });

        // 监听网络恢复事件
        window.addEventListener('online', () => {
            if (networkPaused) {
                networkPaused = false; // 恢复网络状态标记
                updateStatus(
                    Math.round((uploadedSize / file.size) * 100),
                    '',
                    '网络恢复，您可以重新开始上传'
                );
            }
        });
    </script>
</body>
</html>

```

`后端代码：`

```js

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { rimraf } = require('rimraf');

const app = express();
const upload = multer({ dest: 'uploads_temp' });

// 配置 CORS，允许所有来源访问
app.use(cors({
    origin: true, // 允许所有来源
    methods: ['GET', 'POST', 'OPTIONS'], // 允许的 HTTP 方法
    allowedHeaders: ['Content-Type', 'Authorization'], // 允许的请求头
    credentials: true // 允许发送凭证
}));

app.use(express.json());
app.use(express.static('public'));

// 添加健康检查端点
app.get('/', (req, res) => {
    res.json({ status: 'ok' });
});

// 获取已上传的分片
app.get('/uploaded-chunks', async (req, res) => {
    const { hash } = req.query;
    const chunksDir = path.join(__dirname, 'uploads_temp', hash);

    try {
        const files = await fsPromises.readdir(chunksDir);
        const uploadedChunks = files.map(file => parseInt(file, 10));
        res.json(uploadedChunks);
    } catch (err) {
        console.error('获取已上传分片失败:', err);
        res.json([]);
    }
});

// 处理文件分片上传
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { hash, chunkIndex, filename } = req.body;
        console.log('接收到上传请求:', { hash, chunkIndex, filename });
        
        if (!req.file) {
            console.error('没有接收到文件');
            return res.status(400).json({ success: false, error: '没有文件' });
        }

        const chunksDir = path.join(__dirname, 'uploads_temp', hash);
        
        try {
            await fsPromises.access(chunksDir);
        } catch {
            await fsPromises.mkdir(chunksDir, { recursive: true });
        }

        const chunkPath = path.join(chunksDir, chunkIndex);
        await fsPromises.rename(req.file.path, chunkPath);
        
        console.log('分片保存成功:', chunkPath);
        res.json({ success: true });
    } catch (error) {
        console.error('上传处理错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 合并文件分片
app.post('/merge', async (req, res) => {
    try {
        const { filename, hash } = req.body;
        console.log('接收到合并请求:', { filename, hash });

        const chunksDir = path.join(__dirname, 'uploads_temp', hash);
        const uploadDir = path.join(__dirname, 'uploads');
        
        try {
            await fsPromises.access(uploadDir);
        } catch {
            await fsPromises.mkdir(uploadDir, { recursive: true });
        }

        try {
            await fsPromises.access(chunksDir);
        } catch {
            return res.status(400).json({ success: false, error: '没有找到文件分片' });
        }

        const chunks = await fsPromises.readdir(chunksDir);
        const sortedChunks = chunks.sort((a, b) => a - b);
        const filePath = path.join(uploadDir, filename);
        
        // 合并文件
        const writeStream = fs.createWriteStream(filePath);
        for (const chunk of sortedChunks) {
            const chunkPath = path.join(chunksDir, chunk);
            const chunkData = await fsPromises.readFile(chunkPath);
            writeStream.write(chunkData);
            await fsPromises.unlink(chunkPath); // 删除分片文件
        }
        writeStream.end();

        // 确保文件流已完成
        writeStream.on('finish', async () => {
            setTimeout(async () => {
                try {
                    // 使用 rimraf 异步删除临时目录
                    await rimraf(chunksDir, { force: true });
                    console.log('文件合并完成:', filePath);
                    res.json({ 
                        success: true,
                        filePath: filePath,
                        status: 'ok',
                        message: '文件合并成功'
                    });
                } catch (err) {
                    console.error('删除临时目录错误:', err);
                    res.status(500).json({ success: false, error: '删除临时目录错误' });
                }
            }, 1000); // 延迟 1 秒删除
        });

        writeStream.on('error', (err) => {
            console.error('文件写入错误:', err);
            res.status(500).json({ success: false, error: '文件写入错误' });
        });
        
    } catch (error) {
        console.error('合并处理错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});

const port = 9999;
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
}); 
```

通过本篇博客，我们一起探讨了如何实现一个高效且可靠的大文件上传方案，包括文件分片上传、断点续传、上传进度显示、上传速度优化以及错误处理等关键技术。在实际开发中，处理大文件上传常常需要面对带宽限制、网络波动和服务器负载等问题，本文提供的方案可以帮助开发者解决这些挑战。

随着前端技术的不断发展，我们可以利用现代的 Web API 和浏览器功能，构建更为流畅和智能的文件上传体验。无论是在个人项目中，还是在企业级应用中，这些技术都具有重要的实用价值。下一期小编将在本文基础上再出一篇关于 `Web Worker `的博客，它通过并行下载多个分片来加速大文件下载，敬请期待...

如果您有任何问题或改进建议，欢迎在评论区留言讨论。希望本文能够对您解决实际问题有所帮助，也期待与大家一起深入探讨更多技术话题。

感谢您的阅读，祝您的开发工作顺利！📦🚀

小编把源码贴在这里，需要的朋友自行查看：
[源代码](https://github.com/huangkaihao666/big-file-upload.git)

制作不易，可否点个赞呢，感谢

<p align="center"><img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/c89d103138014c4aacd414bc42026add~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg5oC75piv552h5LiN5aSf:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMjU3MTEzMTIzMTE1MDQ4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1735980299&x-orig-sign=2zNd2ZcapGgGTyQwiixZ%2FpYzttM%3D" alt="u=1266244542,2333277913&#x26;fm=253&#x26;fmt=auto&#x26;app=138&#x26;f=PNG.webp" width="50%"></p>
