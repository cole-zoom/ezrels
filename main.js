const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle file selection dialog
ipcMain.handle('select-topics-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Gzipped Files', extensions: ['gz'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      let content;
      
      // Check if file is gzipped by extension or magic number
      const isGzipped = filePath.endsWith('.gz') || filePath.endsWith('.gzip');
      
      if (isGzipped) {
        // Read as buffer and decompress
        const buffer = fs.readFileSync(filePath);
        const decompressed = zlib.gunzipSync(buffer);
        content = decompressed.toString('utf-8');
      } else {
        // Read as regular text file
        content = fs.readFileSync(filePath, 'utf-8');
      }
      
      return { success: true, content, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'No file selected' };
});

// Handle qrels file saving
ipcMain.handle('save-qrels', async (event, qrelsContent) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save qrels file',
    defaultPath: path.join(app.getPath('documents'), 'output.txt'),
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'QRELS Files', extensions: ['qrels'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, qrelsContent, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'Save cancelled' };
});

// Handle autosave
ipcMain.handle('autosave-qrels', async (event, qrelsContent) => {
  try {
    const autosaveDir = path.join(__dirname, 'autosave');
    
    // Create autosave directory if it doesn't exist
    if (!fs.existsSync(autosaveDir)) {
      fs.mkdirSync(autosaveDir, { recursive: true });
    }
    
    // Use a fixed filename to overwrite previous autosave
    const filename = 'autosave.qrels';
    const filePath = path.join(autosaveDir, filename);
    
    fs.writeFileSync(filePath, qrelsContent, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle loading existing qrels file
ipcMain.handle('load-qrels', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'QRELS Files', extensions: ['qrels', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'No file selected' };
});

