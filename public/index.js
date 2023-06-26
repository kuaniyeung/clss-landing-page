import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';

// If you enabled Analytics in your project, add the Firebase SDK for Google Analytics
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js';

// Add Firebase products that you want to use
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  startAt,
  Timestamp,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyD63JTPEgbSsHNbmUzZfHlhbOpwe-YnVwk',
  authDomain: 'clss-landing-page.firebaseapp.com',
  databaseURL: 'https://clss-landing-page-default-rtdb.firebaseio.com',
  projectId: 'clss-landing-page',
  storageBucket: 'clss-landing-page.appspot.com',
  messagingSenderId: '829445182588',
  appId: '1:829445182588:web:895b3f337ac4322e4565f9',
  measurementId: 'G-660QTBN8K1',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// DOM Elements

const colourBlock = document.getElementById('colour-block');
const navList = document.getElementById('nav__list');
const navOpenIcon = document.querySelector('.nav__icon--open');
const navCloseIcon = document.querySelector('.nav__icon--close');
const messageForm = document.getElementById('msg-form');
const nameInput = document.getElementById('name-label');
const titleInput = document.getElementById('title-label');
const messageInput = document.getElementById('message-label');
const messageBoard = document.getElementById('msg-board__msg-cards');
const noMessageBanner = document.getElementById('msg-board__banner');
const prevButton = document.getElementById('msg-board__pagination--prev');
const nextButton = document.getElementById('msg-board__pagination--next');
const thumbsUpCount = document.getElementById('thumbs-up__count');
const thumbsUpButton = document.getElementById('thumbs-up__add');

// *** MESSAGE BOARD SESSION *** //
const messageCollectionRef = collection(db, 'messages');
let oldestMessage;
let newestMessage;
let newestMessageData;
let lastMessageInPrevQuery;
let firstMessageInPrevPage;
let firstMessageInUI;
let numOfMessagesInQuery;
let pageSize = 8;

// Add new message to DB
async function addMessageToDB(message, title, name) {
  const longTimestamp = Timestamp.now().toDate();
  const shortTimestamp = longTimestamp.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  try {
    await addDoc(messageCollectionRef, {
      message: message,
      title: title,
      name: name,
      date: shortTimestamp,
      createdAt: longTimestamp,
    });
  } catch (e) {
    console.error('Error adding document: ', e);
  }
}

// Add message to UI
async function submitMessage(e) {
  e.preventDefault();

  const newName = nameInput.value;
  const newTitle = titleInput.value;
  const newMessageContent = messageInput.value;

  // Validate Input
  if (newName === '' || newTitle === '' || newMessageContent === '') {
    alert('Please fill in all fields');
    return;
  }

  // Add message to DB
  addMessageToDB(newMessageContent, newTitle, newName);

  // List out new message + 4 more
  try {
    const newestMessagesQuery = query(
      messageCollectionRef,
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    const newestMessagesFromDB = await getDocs(newestMessagesQuery);
    newestMessage = newestMessagesFromDB.docs[0];
    newestMessageData = newestMessagesFromDB.docs[0].data();

    messageBoard.innerHTML = '';

    newestMessagesFromDB.forEach((doc) => {
      const message = doc.data();
      addMessageToDOM(message);
    });

    // Show buttons if there are more than 5 messages
    if (
      newestMessagesFromDB.docs.length == pageSize &&
      newestMessagesFromDB.docs[pageSize - 1].id !== oldestMessage.id
    ) {
      lastMessageInPrevQuery = newestMessagesFromDB.docs[pageSize - 1];
      prevButton.style.display = 'block';
      nextButton.style.display = 'block';
      prevButton.disabled = true;
    } else {
      prevButton.style.display = 'none';
      nextButton.style.display = 'none';
    }
  } catch (e) {
    console.error('Error getting documents: ', e);
  }

  // Reset input field
  nameInput.value = '';
  titleInput.value = '';
  messageInput.value = '';

  return newestMessage;
}

// Create message DOM element
function addMessageToDOM(message) {
  const messageCard = document.createElement('div');
  messageCard.classList.add('msg-board__msg--card');
  messageCard.innerHTML = `
                          <div class="msg-board__msg--card-title">${message.title}</div>
                            <div class="msg-board__msg--card-name">${message.name} says:</div>
                            <div class="msg-board__msg--card-copy">
                              ${message.message}
                            </div>
                            <div class="msg-board__msg--card-date">${message.date}</div>
                          `;

  messageBoard.appendChild(messageCard);

  return;
}

// *** Pagination *** //

async function getNewestAndOldestMessages() {
  checkPageSize();

  console.log(pageSize);
  // Query to find the newest message
  const newestMessageQuery = query(
    messageCollectionRef,
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  try {
    const newestMessageRef = await getDocs(newestMessageQuery);
    newestMessage = newestMessageRef.docs[0];
    firstMessageInPrevPage = newestMessageRef.docs[0];
    lastMessageInPrevQuery = newestMessageRef.docs[pageSize - 1];
  } catch (e) {
    console.error('Error getting documents: ', e);
  }

  // Query to find the oldest message
  const oldestMessageQuery = query(
    messageCollectionRef,
    orderBy('createdAt', 'asc'),
    limit(1)
  );

  try {
    const oldestMessageRef = await getDocs(oldestMessageQuery);

    if (oldestMessageRef.empty) {
      noMessageBanner.style.display = 'block';
      return;
    }

    oldestMessage = oldestMessageRef.docs[0];
  } catch (e) {
    console.error('Error getting documents: ', e);
  }

  // Custom event to trigger other events when this function is run
  const dataReadyEvent = new CustomEvent('dataReady');
  document.dispatchEvent(dataReadyEvent);

  return (
    newestMessage, oldestMessage, firstMessageInPrevPage, lastMessageInPrevQuery
  );
}

// Display first page of messages to UI
async function displayMessages() {
  checkPageSize();
  messageBoard.innerHTML = '';
  console.log('Content cleared');

  // Initial query to get the first page of documents
  const firstPageQuery = query(
    messageCollectionRef,
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  try {
    const messagesFromDB = await getDocs(firstPageQuery);

    // No messages
    if (messagesFromDB.empty) {
      noMessageBanner.style.display = 'block';
      return;
    }

    // Less than or only one page of messages in DB
    if (
      messagesFromDB.docs.length < pageSize ||
      messagesFromDB.docs[pageSize - 1].id == oldestMessage.id
    ) {
      messagesFromDB.forEach((doc) => {
        const message = doc.data();
        addMessageToDOM(message);
      });

      return;
    }

    // More than one page
    lastMessageInPrevQuery =
      messagesFromDB.docs[messagesFromDB.docs.length - 1];
    firstMessageInPrevPage = messagesFromDB.docs[0];

    messagesFromDB.forEach((doc) => {
      const message = doc.data();
      addMessageToDOM(message);
    });

    prevButton.style.display = 'block';
    nextButton.style.display = 'block';

    // Hide Prev Button
    prevButton.disabled = true;
  } catch (e) {
    console.error('Error getting documents: ', e);
  }

  return;
}

async function getFirstMessageInPrevPage() {
  checkPageSize();

  const firstMessageInPrevPageQuery = query(
    messageCollectionRef,
    orderBy('createdAt', 'asc'),
    startAt(firstMessageInUI),
    limit(pageSize + 1)
  );

  const firstMessageInPrevPageRef = await getDocs(firstMessageInPrevPageQuery);

  firstMessageInPrevPage = firstMessageInPrevPageRef.docs[pageSize];

  return firstMessageInPrevPage;
}

// Fetch next Pages of Messages
async function fetchNextPage(e) {
  e.preventDefault();
  checkPageSize();

  // Query to use when there was a prev page
  const nextPageQuery = query(
    messageCollectionRef,
    orderBy('createdAt', 'desc'),
    startAfter(lastMessageInPrevQuery),
    limit(pageSize)
  );

  try {
    const nextPageRef = await getDocs(nextPageQuery);
    numOfMessagesInQuery = nextPageRef.docs.length;

    // Last page of all messages with less than or exactly 5 message
    if (
      (numOfMessagesInQuery < pageSize && numOfMessagesInQuery > 0) ||
      (numOfMessagesInQuery == pageSize &&
        nextPageRef.docs[pageSize - 1].id == oldestMessage.id)
    ) {
      // Disable Next Button
      nextButton.disabled = true;

      // Record first message in UI
      firstMessageInUI = nextPageRef.docs[0];
      getFirstMessageInPrevPage();

      messageBoard.innerHTML = '';

      nextPageRef.forEach((doc) => {
        const message = doc.data();
        addMessageToDOM(message);
      });

      // Enable Prev Button
      prevButton.disabled = false;

      return;
    }

    firstMessageInPrevPage = nextPageRef.docs[0];
    lastMessageInPrevQuery = nextPageRef.docs[pageSize - 1];

    prevButton.disabled = false;

    // Record first message in UI
    firstMessageInUI = nextPageRef.docs[0];
    getFirstMessageInPrevPage();

    messageBoard.innerHTML = '';

    nextPageRef.forEach((doc) => {
      const message = doc.data();
      addMessageToDOM(message);
    });

    return;
  } catch (e) {
    console.error('Error getting documents: ', e);
  }
}

// Fetch previous Pages of Messages
async function fetchPrevPage(e) {
  e.preventDefault();
  checkPageSize();

  // Query to use for prev after last page
  const firstPageQuery = query(
    messageCollectionRef,
    orderBy('createdAt', 'desc'),
    startAt(firstMessageInPrevPage),
    limit(pageSize)
  );

  try {
    const prevPageRef = await getDocs(firstPageQuery);
    numOfMessagesInQuery = prevPageRef.docs.length;

    // First page of all messages
    if (prevPageRef.docs[0].id == newestMessage.id) {
      // Record first message in UI
      firstMessageInUI = prevPageRef.docs[0];
      getFirstMessageInPrevPage();

      // Hide Prev Button
      prevButton.disabled = true;

      messageBoard.innerHTML = '';

      prevPageRef.forEach((doc) => {
        const message = doc.data();
        addMessageToDOM(message);
      });

      // Enable Prev Button
      nextButton.disabled = false;

      return;
    }

    // More pages in prev

    lastMessageInPrevQuery = prevPageRef.docs[pageSize - 1];

    // Record first message in UI
    firstMessageInUI = prevPageRef.docs[0];
    getFirstMessageInPrevPage();

    messageBoard.innerHTML = '';

    nextButton.disabled = false;

    prevPageRef.forEach((doc) => {
      const message = doc.data();
      addMessageToDOM(message);
    });

    return;
  } catch (e) {
    console.error('Error getting documents: ', e);
  }
}

// *** THUMBS UP SESSION *** //

// Get current Thumbsup count from DB
let currentThumbsUpCount;

function getAndDisplayThumbsUpCount() {
  onSnapshot(doc(db, 'thumbs-up', 'thumbs-up'), (doc) => {
    const source = doc.metadata.hasPendingWrites ? 'Local' : 'Server';
    currentThumbsUpCount = doc.data().count;
    thumbsUpCount.innerHTML = currentThumbsUpCount;
  });

  return currentThumbsUpCount;
}

// Add Thumbsup to DB
async function addThumbsupToDB() {
  const thumbsUpFromDB = doc(db, 'thumbs-up', 'thumbs-up');
  getAndDisplayThumbsUpCount();
  const addOne = currentThumbsUpCount + 1;

  try {
    const updatedCount = await updateDoc(thumbsUpFromDB, {
      count: addOne,
    });
  } catch (e) {
    console.error('Error updating document: ', e);
  }
}

// Add Thumbsup to UI
function addThumbsUp(e) {
  e.preventDefault();
  thumbsUpButton.classList.add('clicked');

  setTimeout(() => {
    thumbsUpButton.classList.remove('clicked');
  }, 100);

  // Add count to DB
  addThumbsupToDB();

  // Get current count from DB & Display in UI
  getAndDisplayThumbsUpCount();
}

// Check UI State
function checkUI() {
  nameInput.value = '';
  titleInput.value = '';
  messageInput.value = '';
}

// Check window size for # of messages displayed
function checkPageSize() {
  if (window.innerWidth <= 1423) {
    pageSize = 8;
  }

  if (window.innerWidth <= 1167) {
    pageSize = 6;
  }

  return pageSize;
}

// Resizing Event for # of displayed messages
let isResizing;

function resizeEvent() {
  window.clearTimeout(isResizing);

  isResizing = setTimeout(function () {
    displayMessages();
  }, 100);
}

// Nav Bar Media Query

function clickOpen() {
  navOpenIcon.classList.add('inactive');
  navCloseIcon.classList.add('active');
  navList.classList.add('open');
  colourBlock.classList.add('open');
}

function clickClose() {
  navOpenIcon.classList.remove('inactive');
  navCloseIcon.classList.remove('active');
  navList.classList.remove('open');
  navList.classList.add('transition');
  colourBlock.classList.remove('open');
  colourBlock.classList.add('transition');

  setTimeout(() => {
    navList.classList.remove('transition');
    colourBlock.classList.remove('transition');
  }, 1000);
}

// Initialize App
function init() {
  // Event Listeners
  messageForm.addEventListener('submit', submitMessage);
  document.addEventListener('dataReady', displayMessages);
  prevButton.addEventListener('click', fetchPrevPage);
  nextButton.addEventListener('click', fetchNextPage);
  thumbsUpButton.addEventListener('click', addThumbsUp);
  document.addEventListener('DOMContentLoaded', getAndDisplayThumbsUpCount);
  window.addEventListener('resize', resizeEvent);
  navOpenIcon.addEventListener('click', clickOpen);
  navCloseIcon.addEventListener('click', clickClose);

  checkUI();
  getNewestAndOldestMessages();
}

init();
