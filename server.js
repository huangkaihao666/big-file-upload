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