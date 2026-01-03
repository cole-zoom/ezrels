let topics = [];
let currentTopicIndex = 0;
let currentDocIndex = 0;
let relevanceData = {}; // Store relevance: { topicNo: { docNo: 0 or 1 } }

// Parse the topics file using DOM Parser for XML
function parseTopicsFile(content) {
  const parser = new DOMParser();
  const parsedTopics = [];
  
  // Find all topic blocks - split by looking for topic_no tags
  const topicStarts = [];
  let searchPos = 0;
  
  while (true) {
    const pos = content.indexOf('<topic_no>', searchPos);
    if (pos === -1) break;
    topicStarts.push(pos);
    searchPos = pos + 1;
  }
  
  // Process each topic
  for (let i = 0; i < topicStarts.length; i++) {
    const startPos = topicStarts[i];
    const endPos = i < topicStarts.length - 1 ? topicStarts[i + 1] : content.length;
    const topicBlock = content.substring(startPos, endPos);
    
    // Extract XML metadata tags using DOM parser
    const topicNo = extractXMLTag(topicBlock, 'topic_no');
    const title = extractXMLTag(topicBlock, 'topic_title');
    const desc = extractXMLTag(topicBlock, 'topic_desc');
    const narrative = extractXMLTag(topicBlock, 'topic_narrative');
    
    // Find where the narrative ends to get documents section
    const narrativeEndTag = '</topic_narrative>';
    const narrativeEnd = topicBlock.indexOf(narrativeEndTag);
    
    if (narrativeEnd !== -1) {
      const documentsSection = topicBlock.substring(narrativeEnd + narrativeEndTag.length);
      
      // Split by </document> tag and keep the tag
      const docs = documentsSection.split('</document>').filter(doc => doc.trim().length > 0);
      const documents = docs.map(doc => doc.trim() + '</document>');
      
      parsedTopics.push({
        topicNo,
        title,
        desc,
        narrative,
        documents
      });
    }
  }
  
  return parsedTopics;
}

// Helper function to extract content from XML tags
function extractXMLTag(content, tagName) {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;
  
  const startPos = content.indexOf(startTag);
  const endPos = content.indexOf(endTag);
  
  if (startPos !== -1 && endPos !== -1) {
    const start = startPos + startTag.length;
    return content.substring(start, endPos).trim();
  }
  
  return '';
}

// Extract docno from document content
function extractDocNo(docContent) {
  const lines = docContent.split('\n');
  for (const line of lines) {
    const match = line.match(/docno:\s*(.+)/i);
    if (match) {
      return match[1].trim();
    }
  }
  return 'UNKNOWN';
}

// Initialize relevance data for all topics/docs
function initializeRelevanceData() {
  relevanceData = {};
  topics.forEach(topic => {
    relevanceData[topic.topicNo] = {};
    topic.documents.forEach(doc => {
      const docNo = extractDocNo(doc);
      relevanceData[topic.topicNo][docNo] = 0; // Default to not relevant
    });
  });
}

// Generate qrels content from current relevance data
function generateQrelsContent() {
  let qrelsContent = '';
  topics.forEach(topic => {
    topic.documents.forEach(doc => {
      const docNo = extractDocNo(doc);
      const relevance = relevanceData[topic.topicNo][docNo];
      // Format: topic_no iteration doc_no relevance
      qrelsContent += `${topic.topicNo} 0 ${docNo} ${relevance}\n`;
    });
  });
  return qrelsContent;
}

// Autosave function
async function autosave() {
  const qrelsContent = generateQrelsContent();
  const result = await window.electronAPI.autosaveQrels(qrelsContent);
  
  // Silent autosave - no status message shown
  if (!result.success) {
    console.error('Autosave failed:', result.error);
  }
}

// Update the display
function updateDisplay() {
  if (topics.length === 0) return;
  
  const topic = topics[currentTopicIndex];
  
  // Update topic info
  document.getElementById('topic-number').textContent = topic.topicNo;
  document.getElementById('topic-title').textContent = topic.title;
  document.getElementById('topic-desc').textContent = topic.desc;
  document.getElementById('topic-narrative').textContent = topic.narrative;
  document.getElementById('current-topic-num').textContent = currentTopicIndex + 1;
  document.getElementById('total-topics').textContent = topics.length;
  
  // Update document display
  if (topic.documents.length > 0) {
    const doc = topic.documents[currentDocIndex];
    const docNo = extractDocNo(doc);
    
    document.getElementById('document-content').textContent = doc;
    document.getElementById('doc-number').textContent = docNo;
    document.getElementById('current-doc-num').textContent = currentDocIndex + 1;
    document.getElementById('total-docs').textContent = topic.documents.length;
    
    // Update relevance checkbox
    const isRelevant = relevanceData[topic.topicNo][docNo] === 1;
    document.getElementById('relevant-checkbox').checked = isRelevant;
  }
  
  // Update button states
  document.getElementById('prev-topic-btn').disabled = currentTopicIndex === 0;
  document.getElementById('next-topic-btn').disabled = currentTopicIndex === topics.length - 1;
  document.getElementById('prev-doc-btn').disabled = currentDocIndex === 0;
  document.getElementById('next-doc-btn').disabled = currentDocIndex === topic.documents.length - 1;
}

// Navigation handlers
document.getElementById('prev-topic-btn').addEventListener('click', () => {
  if (currentTopicIndex > 0) {
    currentTopicIndex--;
    currentDocIndex = 0;
    updateDisplay();
  }
});

document.getElementById('next-topic-btn').addEventListener('click', () => {
  if (currentTopicIndex < topics.length - 1) {
    currentTopicIndex++;
    currentDocIndex = 0;
    updateDisplay();
  }
});

document.getElementById('prev-doc-btn').addEventListener('click', () => {
  if (currentDocIndex > 0) {
    currentDocIndex--;
    updateDisplay();
  }
});

document.getElementById('next-doc-btn').addEventListener('click', async () => {
  const topic = topics[currentTopicIndex];
  if (currentDocIndex < topic.documents.length - 1) {
    // Autosave before moving to next document
    await autosave();
    
    currentDocIndex++;
    updateDisplay();
  }
});

// Relevance checkbox handler
document.getElementById('relevant-checkbox').addEventListener('change', (e) => {
  const topic = topics[currentTopicIndex];
  const doc = topic.documents[currentDocIndex];
  const docNo = extractDocNo(doc);
  
  relevanceData[topic.topicNo][docNo] = e.target.checked ? 1 : 0;
});

// File selection
document.getElementById('select-file-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('file-status');
  statusEl.textContent = 'Loading file...';
  
  const result = await window.electronAPI.selectTopicsFile();
  
  if (result.success) {
    try {
      topics = parseTopicsFile(result.content);
      
      if (topics.length === 0) {
        statusEl.textContent = 'Error: No topics found in file';
        statusEl.className = 'error';
        return;
      }
      
      initializeRelevanceData();
      
      // Switch to app screen
      document.getElementById('file-select-screen').style.display = 'none';
      document.getElementById('app-screen').style.display = 'block';
      
      updateDisplay();
    } catch (error) {
      statusEl.textContent = 'Error parsing file: ' + error.message;
      statusEl.className = 'error';
    }
  } else {
    statusEl.textContent = 'Error: ' + result.error;
    statusEl.className = 'error';
  }
});

// Load existing qrels button
document.getElementById('load-qrels-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  
  const result = await window.electronAPI.loadQrels();
  
  if (result.success) {
    try {
      // Parse the qrels file
      const lines = result.content.trim().split('\n');
      const loadedData = {};
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const topicNo = parts[0];
          const docNo = parts[2];
          const relevance = parseInt(parts[3]);
          
          if (!loadedData[topicNo]) {
            loadedData[topicNo] = {};
          }
          loadedData[topicNo][docNo] = relevance;
        }
      });
      
      // Validate and count matches
      let matchedCount = 0;
      let totalCount = 0;
      
      topics.forEach(topic => {
        topic.documents.forEach(doc => {
          const docNo = extractDocNo(doc);
          totalCount++;
          
          if (loadedData[topic.topicNo] && loadedData[topic.topicNo][docNo] !== undefined) {
            relevanceData[topic.topicNo][docNo] = loadedData[topic.topicNo][docNo];
            matchedCount++;
          }
        });
      });
      
      if (matchedCount === 0) {
        statusEl.textContent = 'Error: No matching topics/documents found in qrels file';
        statusEl.className = 'error';
      } else if (matchedCount < totalCount) {
        statusEl.textContent = `Warning: Only ${matchedCount} of ${totalCount} documents matched. Loaded partial data.`;
        statusEl.className = 'warning';
        updateDisplay();
      } else {
        statusEl.textContent = `Success: Loaded relevance data for ${matchedCount} documents`;
        statusEl.className = 'success';
        updateDisplay();
      }
      
      setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = '';
      }, 5000);
      
    } catch (error) {
      statusEl.textContent = 'Error parsing qrels file: ' + error.message;
      statusEl.className = 'error';
    }
  } else {
    if (result.error !== 'No file selected') {
      statusEl.textContent = 'Error: ' + result.error;
      statusEl.className = 'error';
    }
  }
});

// Produce qrels button
document.getElementById('produce-qrels-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  
  const qrelsContent = generateQrelsContent();
  
  // Save the file
  const result = await window.electronAPI.saveQrels(qrelsContent);
  
  if (result.success) {
    statusEl.textContent = `Qrels file saved successfully to: ${result.filePath}`;
    statusEl.className = 'success';
  } else {
    statusEl.textContent = 'Error saving qrels file: ' + result.error;
    statusEl.className = 'error';
  }
  
  // Clear status after 5 seconds
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = '';
  }, 5000);
});

