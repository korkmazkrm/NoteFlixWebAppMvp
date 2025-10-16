/* ---------- Dexie Database Configuration ---------- */
// Import Dexie (eğer module olarak kullanılıyorsa)
// import Dexie from './dexie.js';

/* ---------- Database Constants ---------- */
const DB_NAME = 'NoteFlixDB';
const DB_VERSION = 140;

/* ---------- Store Names ---------- */
const STORE_NAME = 'notes';
const COMMENTS_STORE_NAME = 'comments';
const FOLDERS_STORE_NAME = 'folders';
const TAGS_STORE_NAME = 'tags';

/* ---------- Global Database Instance ---------- */
let db = null;

/* ---------- Initialize Database with Dexie ---------- */
function initDB() {
	return new Promise((resolve, reject) => {
		try {
			// Create Dexie instance
			db = new Dexie(DB_NAME);

			// Define database schema
			db.version(DB_VERSION).stores({
				// Notes store
				notes: '++id, title, createdAt, updatedAt, isFavorite, isArchived, isDeleted, reminderDateTime, folderId, parentNoteId',
				
				// Comments store
				comments: '++id, noteId, author, createdAt, updatedAt',
				
				// Folders store
				folders: '++id, name, createdAt, updatedAt',
				
				// Tags store
				tags: '++id, name, createdAt, updatedAt'
			});

			// Open database
			db.open()
				.then(() => {
					console.log('✅ Database initialized successfully with Dexie');
					console.log('📊 Database Name:', DB_NAME);
					console.log('📌 Version:', DB_VERSION);
					console.log('📁 Stores:', Object.keys(db._dbSchema));
					resolve(db);
				})
				.catch((error) => {
					console.error('❌ Error opening database:', error);
					reject(error);
				});

		} catch (error) {
			console.error('❌ Error initializing database:', error);
			reject(error);
		}
	});
}

/* ---------- Get Database Instance ---------- */
function getDB() {
	if (!db) {
		console.warn('⚠️ Database not initialized. Call initDB() first.');
		return null;
	}
	return db;
}

/* ---------- Check if Database is Ready ---------- */
function isDBReady() {
	return db !== null && db.isOpen();
}

/* ---------- Close Database ---------- */
function closeDB() {
	if (db && db.isOpen()) {
		db.close();
		console.log('🔒 Database closed');
	}
}

/* ---------- Export for Global Access ---------- */
// Make functions available globally
window.initDB = initDB;
window.getDB = getDB;
window.isDBReady = isDBReady;
window.closeDB = closeDB;

// Export constants
window.DB_NAME = DB_NAME;
window.DB_VERSION = DB_VERSION;
window.STORE_NAME = STORE_NAME;
window.COMMENTS_STORE_NAME = COMMENTS_STORE_NAME;
window.FOLDERS_STORE_NAME = FOLDERS_STORE_NAME;
window.TAGS_STORE_NAME = TAGS_STORE_NAME;

// Export db instance getter
Object.defineProperty(window, 'db', {
	get: function() {
		return db;
	},
	set: function(value) {
		db = value;
	}
});

console.log('📦 Database module loaded successfully');

/* ---------- Notes Query Functions ---------- */

/**
 * Get notes with flexible filtering and sorting options
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Filtered and sorted notes
 */
async function getNotesWithFilters(options = {}) {
	if (!db) await initDB();

	const {
		// Basic filters
		includeArchived = false,
		includeDeleted = false,
		onlyFavorites = false,
		onlyArchived = false,
		onlyDeleted = false,
		
		// Advanced filters (for loadNotes)
		hasOverdue = false,
		hasDueDate = false,
		hasColor = false,
		hasReminder = false,
		hasParentNote = false,
		hasComments = false,
		hasFolder = false,
		
		// Sorting
		sortBy = 'updated', // 'title', 'created', 'updated'
		sortDirection = 'desc', // 'asc', 'desc'
		
		// External dependencies
		getCommentsByNoteIdFunc = null // For comments filter
	} = options;

	try {
		// Get all notes using Dexie
		let notes = await db.notes.toArray();

		// Apply basic filters
		if (!includeArchived && !onlyArchived) {
			notes = notes.filter(note => note.isArchived !== true);
		}
		if (!includeDeleted) {
			notes = notes.filter(note => note.isDeleted !== true);
		}

		// Only favorites filter
		if (onlyFavorites) {
			notes = notes.filter(note => note.isFavorite && !note.isArchived && !note.isDeleted);
		}

		// Only archived filter
		if (onlyArchived) {
			notes = notes.filter(note => note.isArchived && !note.isDeleted);
		}

		// Only deleted filter
		if (onlyDeleted) {
			notes = notes.filter(note => note.isDeleted);
		}

		// Advanced filters
		if (hasOverdue) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			
			notes = notes.filter(note => {
				if (!note.dueDate) return false;
				const dueDate = new Date(note.dueDate);
				dueDate.setHours(0, 0, 0, 0);
				return dueDate < today;
			});
		}

		if (hasDueDate) {
			notes = notes.filter(note => note.dueDate);
		}

		if (hasColor) {
			notes = notes.filter(note => note.bgColor);
		}

		if (hasReminder) {
			notes = notes.filter(note => note.reminderDateTime);
		}

		if (hasParentNote) {
			notes = notes.filter(note => note.parentNoteId);
		}

		if (hasFolder) {
			notes = notes.filter(note => note.folderId);
		}

		// Comments filter (requires external function)
		if (hasComments && getCommentsByNoteIdFunc) {
			const notesWithComments = [];
			for (const note of notes) {
				try {
					const comments = await getCommentsByNoteIdFunc(note.id);
					if (comments && comments.length > 0) {
						notesWithComments.push(note);
					}
				} catch (error) {
					console.error('Error checking comments for note:', note.id, error);
				}
			}
			notes = notesWithComments;
		}

		// Apply sorting
		notes = applySorting(notes, sortBy, sortDirection);

		return notes;

	} catch (error) {
		console.error('❌ Error getting filtered notes:', error);
		throw error;
	}
}

/**
 * Helper function to apply sorting to notes array
 * @param {Array} notes - Notes array to sort
 * @param {String} sortBy - Sort field ('title', 'created', 'updated')
 * @param {String} sortDirection - Sort direction ('asc', 'desc')
 * @returns {Array} Sorted notes
 */
function applySorting(notes, sortBy, sortDirection) {
	const sorted = [...notes]; // Create a copy to avoid mutation

	switch (sortBy) {
		case 'title':
			sorted.sort((a, b) => {
				const comparison = (a.title || '').localeCompare(b.title || '');
				return sortDirection === 'desc' ? -comparison : comparison;
			});
			break;
		case 'created':
			sorted.sort((a, b) => {
				const comparison = new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt);
				return sortDirection === 'desc' ? comparison : -comparison;
			});
			break;
		case 'updated':
		default:
			sorted.sort((a, b) => {
				const comparison = new Date(b.updatedAt) - new Date(a.updatedAt);
				return sortDirection === 'desc' ? comparison : -comparison;
			});
			break;
	}

	return sorted;
}

/* ---------- Folder Functions ---------- */

/**
 * Get folder by ID
 * @param {Number} folderId - Folder ID
 * @returns {Promise<Object>} Folder object
 */
async function getFolderById(folderId) {
	if (!db) await initDB();

	try {
		const folder = await db.folders.get(folderId);
		return folder;
	} catch (error) {
		console.error('❌ Error getting folder by ID:', error);
		throw error;
	}
}

/**
 * Get all folders
 * @returns {Promise<Array>} Array of folders
 */
async function getAllFolders() {
	if (!db) await initDB();

	try {
		const folders = await db.folders.toArray();
		return folders;
	} catch (error) {
		console.error('❌ Error getting all folders:', error);
		throw error;
	}
}

/**
 * Get all tags
 * @returns {Promise<Array>} Array of tags
 */
async function getAllTags() {
	if (!db) await initDB();

	try {
		const tags = await db.tags.toArray();
		return tags;
	} catch (error) {
		console.error('❌ Error getting all tags:', error);
		throw error;
	}
}

/**
 * Get all notes (for counting purposes)
 * @returns {Promise<Array>} Array of all notes
 */
async function getAllNotesForCounting() {
	if (!db) await initDB();

	try {
		const notes = await db.notes.toArray();
		return notes;
	} catch (error) {
		console.error('❌ Error getting all notes for counting:', error);
		throw error;
	}
}

/**
 * Get all notes (alias for getAllNotesForCounting)
 * @returns {Promise<Array>} Array of all notes
 */
async function getAllNotes() {
	if (!db) await initDB();

	try {
		const notes = await db.notes.toArray();
		return notes;
	} catch (error) {
		console.error('❌ Error getting all notes:', error);
		throw error;
	}
}

/**
 * Get note by ID
 * @param {Number} noteId - Note ID
 * @returns {Promise<Object>} Note object
 */
async function getNoteById(noteId) {
	if (!db) await initDB();

	try {
		const note = await db.notes.get(noteId);
		return note;
	} catch (error) {
		console.error('❌ Error getting note by ID:', error);
		throw error;
	}
}

/**
 * Get current displayed notes (filtered based on current view)
 * @returns {Promise<Array>} Array of filtered notes
 */
async function getCurrentDisplayedNotes() {
	if (!db) await initDB();

	try {
		let notes = await db.notes.toArray();

		// Arşivlenmiş ve silinmiş notları filtrele
		notes = notes.filter(note => note.isArchived !== true && note.isDeleted !== true);

		// Hedef tarihi geçmiş notları filtrele (eğer toggle aktifse)
		if (window.showOverdueOnly) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			notes = notes.filter(note => {
				if (!note.dueDate) return false;
				const dueDate = new Date(note.dueDate);
				dueDate.setHours(0, 0, 0, 0);
				return dueDate < today;
			});
		}

		// Hedef tarihi olan notları filtrele (eğer toggle aktifse)
		if (window.showHasDueDateOnly) {
			notes = notes.filter(note => note.dueDate);
		}

		// Renk atanmış notları filtrele (eğer toggle aktifse)
		if (window.showHasColorOnly) {
			notes = notes.filter(note => note.bgColor);
		}

		// Hatırlatıcısı olan notları filtrele (eğer toggle aktifse)
		if (window.showHasReminderOnly) {
			notes = notes.filter(note => note.reminderDateTime);
		}

		// Üst not seçili olan notları filtrele (eğer toggle aktifse)
		if (window.showHasParentNoteOnly) {
			notes = notes.filter(note => note.parentNoteId);
		}

		// Klasör bilgisi olan notları filtrele (eğer toggle aktifse)
		if (window.showHasFolderInfoOnly) {
			notes = notes.filter(note => note.folderId);
		}

		// Apply sorting based on current sort option and direction
		if (window.currentSortOption && window.currentSortDirection) {
			notes = applySorting(notes, window.currentSortOption, window.currentSortDirection);
		}

		return notes;
	} catch (error) {
		console.error('❌ Error getting current displayed notes:', error);
		throw error;
	}
}

/**
 * Get notes with reminders for checking
 * @returns {Promise<Array>} Array of notes with reminders
 */
async function getNotesWithReminders() {
	if (!db) await initDB();

	try {
		const notes = await db.notes.toArray();
		
		// Only get notes that have reminders and are not deleted
		const notesWithReminders = notes.filter(note => 
			note.reminderDateTime && 
			note.isDeleted !== true
		);

		return notesWithReminders;
	} catch (error) {
		console.error('❌ Error getting notes with reminders:', error);
		throw error;
	}
}

/**
 * Get selectable parent notes (not deleted, not archived, excluding current note)
 * @param {Number} excludeNoteId - Note ID to exclude (current note)
 * @returns {Promise<Array>} Array of selectable notes
 */
async function getSelectableParentNotes(excludeNoteId) {
	if (!db) await initDB();

	try {
		let notes = await db.notes.toArray();
		
		// Filter: not deleted, not archived, not current note
		notes = notes.filter(note =>
			note.isDeleted !== true &&
			note.isArchived !== true &&
			note.id !== excludeNoteId
		);

		// Sort by title
		notes.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

		return notes;
	} catch (error) {
		console.error('❌ Error getting selectable parent notes:', error);
		throw error;
	}
}

/* ---------- Notes CRUD Functions ---------- */

/**
 * Create a new note
 * @param {Object} noteData - Note data
 * @returns {Promise<Number>} Created note ID
 */
async function createNote(noteData) {
	if (!db) await initDB();

	try {
		const id = await db.notes.add(noteData);
		console.log('✅ Note created with ID:', id);
		return id;
	} catch (error) {
		console.error('❌ Error creating note:', error);
		throw error;
	}
}

/**
 * Update an existing note
 * @param {Number} id - Note ID
 * @param {Object} noteData - Note data (must include id)
 * @returns {Promise<Number>} Updated note ID
 */
async function updateNoteById(id, noteData) {
	if (!db) await initDB();

	try {
		// Ensure id is included in noteData
		noteData.id = id;
		await db.notes.put(noteData);
		console.log('✅ Note updated with ID:', id);
		return id;
	} catch (error) {
		console.error('❌ Error updating note:', error);
		throw error;
	}
}

/**
 * Soft delete a note (set isDeleted = true)
 * @param {Number} id - Note ID
 * @returns {Promise<Object>} Updated note
 */
async function deleteNoteById(id) {
	if (!db) await initDB();

	try {
		const note = await db.notes.get(id);
		if (!note) {
			throw new Error('Note not found');
		}

		note.isDeleted = true;
		note.updatedAt = new Date().toISOString();
		
		await db.notes.put(note);
		console.log('✅ Note soft deleted with ID:', id);
		return note;
	} catch (error) {
		console.error('❌ Error deleting note:', error);
		throw error;
	}
}

/**
 * Permanently delete a note
 * @param {Number} id - Note ID
 * @returns {Promise<void>}
 */
async function permanentDeleteNoteById(id) {
	if (!db) await initDB();

	try {
		await db.notes.delete(id);
		console.log('✅ Note permanently deleted with ID:', id);
	} catch (error) {
		console.error('❌ Error permanently deleting note:', error);
		throw error;
	}
}

/**
 * Restore a deleted note (set isDeleted = false)
 * @param {Number} id - Note ID
 * @returns {Promise<Object>} Restored note
 */
async function restoreNoteById(id) {
	if (!db) await initDB();

	try {
		const note = await db.notes.get(id);
		if (!note) {
			throw new Error('Note not found');
		}

		note.isDeleted = false;
		note.updatedAt = new Date().toISOString();
		
		await db.notes.put(note);
		console.log('✅ Note restored with ID:', id);
		return note;
	} catch (error) {
		console.error('❌ Error restoring note:', error);
		throw error;
	}
}

/**
 * Archive a note (set isArchived = true)
 * @param {Number} id - Note ID
 * @returns {Promise<Object>} Archived note
 */
async function archiveNoteById(id) {
	if (!db) await initDB();

	try {
		const note = await db.notes.get(id);
		if (!note) {
			throw new Error('Note not found');
		}

		note.isArchived = true;
		note.updatedAt = new Date().toISOString();
		
		await db.notes.put(note);
		console.log('✅ Note archived with ID:', id);
		return note;
	} catch (error) {
		console.error('❌ Error archiving note:', error);
		throw error;
	}
}

/**
 * Unarchive a note (set isArchived = false)
 * @param {Number} id - Note ID
 * @returns {Promise<Object>} Unarchived note
 */
async function unarchiveNoteById(id) {
	if (!db) await initDB();

	try {
		const note = await db.notes.get(id);
		if (!note) {
			throw new Error('Note not found');
		}

		note.isArchived = false;
		note.updatedAt = new Date().toISOString();
		
		await db.notes.put(note);
		console.log('✅ Note unarchived with ID:', id);
		return note;
	} catch (error) {
		console.error('❌ Error unarchiving note:', error);
		throw error;
	}
}

/**
 * Toggle favorite status of a note
 * @param {Number} id - Note ID
 * @returns {Promise<Object>} Updated note
 */
async function toggleNoteFavoriteById(id) {
	if (!db) await initDB();

	try {
		const note = await db.notes.get(id);
		if (!note) {
			throw new Error('Note not found');
		}

		note.isFavorite = !note.isFavorite;
		note.updatedAt = new Date().toISOString();
		
		await db.notes.put(note);
		console.log('✅ Note favorite toggled with ID:', id, 'New status:', note.isFavorite);
		return note;
	} catch (error) {
		console.error('❌ Error toggling note favorite:', error);
		throw error;
	}
}

/**
 * Clear parent note references (set parentNoteId = null for all notes referencing this note)
 * @param {Number} deletedNoteId - Deleted note ID
 * @returns {Promise<Number>} Number of notes updated
 */
async function clearParentNoteReferences(deletedNoteId) {
	if (!db) await initDB();

	try {
		const notes = await db.notes.toArray();
		const notesToUpdate = notes.filter(note => 
			note.parentNoteId === deletedNoteId && 
			!note.isDeleted
		);

		if (notesToUpdate.length === 0) {
			return 0;
		}

		const now = new Date().toISOString();
		const updatePromises = notesToUpdate.map(note => {
			note.parentNoteId = null;
			note.updatedAt = now;
			return db.notes.put(note);
		});

		await Promise.all(updatePromises);
		console.log('✅ Cleared parent note references for', notesToUpdate.length, 'notes');
		return notesToUpdate.length;
	} catch (error) {
		console.error('❌ Error clearing parent note references:', error);
		throw error;
	}
}

/**
 * Clear reminder from a note
 * @param {Number} noteId - Note ID
 * @returns {Promise<void>}
 */
async function clearNoteReminder(noteId) {
	if (!db) await initDB();

	try {
		const note = await db.notes.get(noteId);
		if (note) {
			note.reminderDateTime = null;
			note.updatedAt = new Date().toISOString();
			await db.notes.put(note);
			console.log('✅ Reminder cleared for note:', noteId);
		}
	} catch (error) {
		console.error('❌ Error clearing note reminder:', error);
		throw error;
	}
}

/**
 * Check if folder name is duplicate (excluding a specific folder ID)
 * @param {String} folderName - Folder name to check
 * @param {Number} excludeFolderId - Folder ID to exclude from check
 * @returns {Promise<Boolean>} True if duplicate exists
 */
async function checkDuplicateFolder(folderName, excludeFolderId = null) {
	if (!db) await initDB();

	try {
		const folders = await db.folders.toArray();
		const duplicate = folders.find(folder => 
			folder.name.toLowerCase() === folderName.toLowerCase() && 
			(excludeFolderId === null || parseInt(folder.id) !== parseInt(excludeFolderId))
		);
		return !!duplicate;
	} catch (error) {
		console.error('❌ Error checking duplicate folder:', error);
		throw error;
	}
}

/**
 * Update a folder
 * @param {Number} folderId - Folder ID
 * @param {Object} folderData - Folder data (name, fontColor, bgColor)
 * @returns {Promise<Object>} Updated folder
 */
async function updateFolderById(folderId, folderData) {
	if (!db) await initDB();

	try {
		const folder = await db.folders.get(parseInt(folderId));
		if (!folder) {
			throw new Error('Folder not found');
		}

		folder.name = folderData.name;
		folder.fontColor = folderData.fontColor;
		folder.bgColor = folderData.bgColor;
		folder.updatedAt = new Date().toISOString();

		await db.folders.put(folder);
		console.log('✅ Folder updated with ID:', folderId);
		return folder;
	} catch (error) {
		console.error('❌ Error updating folder:', error);
		throw error;
	}
}

/**
 * Create a new folder
 * @param {Object} folderData - Folder data (name, fontColor, bgColor)
 * @returns {Promise<Number>} Created folder ID
 */
async function createFolder(folderData) {
	if (!db) await initDB();

	try {
		const newFolder = {
			name: folderData.name,
			bgColor: folderData.bgColor,
			fontColor: folderData.fontColor,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		const id = await db.folders.add(newFolder);
		console.log('✅ Folder created with ID:', id);
		return id;
	} catch (error) {
		console.error('❌ Error creating folder:', error);
		throw error;
	}
}

/**
 * Delete a folder
 * @param {Number} folderId - Folder ID
 * @returns {Promise<void>}
 */
async function deleteFolderById(folderId) {
	if (!db) await initDB();

	try {
		await db.folders.delete(folderId);
		console.log('✅ Folder deleted with ID:', folderId);
	} catch (error) {
		console.error('❌ Error deleting folder:', error);
		throw error;
	}
}

/* ---------- Export Folder Functions ---------- */
window.getFolderById = getFolderById;
window.getAllFolders = getAllFolders;
window.checkDuplicateFolder = checkDuplicateFolder;
window.updateFolderById = updateFolderById;
window.createFolder = createFolder;
window.deleteFolderById = deleteFolderById;

/**
 * Get tag by ID
 * @param {Number} tagId - Tag ID
 * @returns {Promise<Object>} Tag object
 */
async function getTagById(tagId) {
	if (!db) await initDB();

	try {
		const tag = await db.tags.get(tagId);
		return tag;
	} catch (error) {
		console.error('❌ Error getting tag by ID:', error);
		throw error;
	}
}

/**
 * Check if tag name is duplicate (excluding a specific tag ID)
 * @param {String} tagName - Tag name to check
 * @param {Number} excludeTagId - Tag ID to exclude from check
 * @returns {Promise<Boolean>} True if duplicate exists
 */
async function checkDuplicateTag(tagName, excludeTagId = null) {
	if (!db) await initDB();

	try {
		const tags = await db.tags.toArray();
		const duplicate = tags.find(tag => 
			tag.name.toLowerCase() === tagName.toLowerCase() && 
			(excludeTagId === null || parseInt(tag.id) !== parseInt(excludeTagId))
		);
		return !!duplicate;
	} catch (error) {
		console.error('❌ Error checking duplicate tag:', error);
		throw error;
	}
}

/**
 * Update a tag
 * @param {Number} tagId - Tag ID
 * @param {Object} tagData - Tag data (name, fontColor, bgColor)
 * @returns {Promise<Object>} Updated tag
 */
async function updateTagById(tagId, tagData) {
	if (!db) await initDB();

	try {
		const tag = await db.tags.get(parseInt(tagId));
		if (!tag) {
			throw new Error('Tag not found');
		}

		tag.name = tagData.name;
		tag.fontColor = tagData.fontColor;
		tag.bgColor = tagData.bgColor;
		tag.updatedAt = new Date().toISOString();

		await db.tags.put(tag);
		console.log('✅ Tag updated with ID:', tagId);
		return tag;
	} catch (error) {
		console.error('❌ Error updating tag:', error);
		throw error;
	}
}

/**
 * Create a new tag
 * @param {Object} tagData - Tag data (name, fontColor, bgColor)
 * @returns {Promise<Number>} Created tag ID
 */
async function createTag(tagData) {
	if (!db) await initDB();

	try {
		const newTag = {
			name: tagData.name,
			bgColor: tagData.bgColor,
			fontColor: tagData.fontColor,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		const id = await db.tags.add(newTag);
		console.log('✅ Tag created with ID:', id);
		return id;
	} catch (error) {
		console.error('❌ Error creating tag:', error);
		throw error;
	}
}

/**
 * Get tag usage count (how many notes use this tag)
 * @param {Number} tagId - Tag ID
 * @returns {Promise<Number>} Usage count
 */
async function getTagUsageCount(tagId) {
	if (!db) await initDB();

	try {
		const notes = await db.notes.toArray();
		let count = 0;

		notes.forEach(note => {
			if (note.tags) {
				const tagIds = note.tags.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
				if (tagIds.includes(tagId)) {
					count++;
				}
			}
		});

		return count;
	} catch (error) {
		console.error('❌ Error getting tag usage count:', error);
		throw error;
	}
}

/**
 * Delete a tag by ID
 * @param {Number} tagId - Tag ID
 * @returns {Promise<void>}
 */
async function deleteTagById(tagId) {
	if (!db) await initDB();

	try {
		await db.tags.delete(tagId);
		console.log('✅ Tag deleted with ID:', tagId);
	} catch (error) {
		console.error('❌ Error deleting tag:', error);
		throw error;
	}
}

/**
 * Remove tag from all notes
 * @param {Number} tagId - Tag ID to remove
 * @returns {Promise<Number>} Number of notes updated
 */
async function removeTagFromAllNotes(tagId) {
	if (!db) await initDB();

	try {
		const notes = await db.notes.toArray();
		const notesToUpdate = [];

		notes.forEach(note => {
			if (note.tags) {
				const tagIds = note.tags.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
				const updatedTagIds = tagIds.filter(id => id !== tagId);

				if (updatedTagIds.length !== tagIds.length) {
					note.tags = updatedTagIds.join(',');
					note.updatedAt = new Date().toISOString();
					notesToUpdate.push(note);
				}
			}
		});

		if (notesToUpdate.length === 0) {
			return 0;
		}

		const updatePromises = notesToUpdate.map(note => db.notes.put(note));
		await Promise.all(updatePromises);

		console.log('✅ Removed tag from', notesToUpdate.length, 'notes');
		return notesToUpdate.length;
	} catch (error) {
		console.error('❌ Error removing tag from all notes:', error);
		throw error;
	}
}

/* ---------- Comments Functions ---------- */

/**
 * Get comments by note ID
 * @param {Number} noteId - Note ID
 * @returns {Promise<Array>} Array of comments
 */
async function getCommentsByNoteId(noteId) {
	if (!noteId) {
		return [];
	}

	if (!db) await initDB();

	try {
		const allComments = await db.comments.toArray();
		const noteComments = allComments.filter(comment => comment.noteId === noteId);
		return noteComments;
	} catch (error) {
		console.error('❌ Error getting comments by note ID:', error);
		throw error;
	}
}

/**
 * Save a new comment
 * @param {Object} comment - Comment data
 * @returns {Promise<Number>} Created comment ID
 */
async function saveComment(comment) {
	if (!db) await initDB();

	try {
		const id = await db.comments.add(comment);
		console.log('✅ Comment created with ID:', id);
		return id;
	} catch (error) {
		console.error('❌ Error saving comment:', error);
		throw error;
	}
}

/**
 * Delete all comments for a specific note
 * @param {Number} noteId - Note ID
 * @returns {Promise<Number>} Number of comments deleted
 */
async function deleteCommentsByNoteId(noteId) {
	if (!db) await initDB();

	try {
		const allComments = await db.comments.toArray();
		const commentsToDelete = allComments.filter(comment => comment.noteId === noteId);

		if (commentsToDelete.length === 0) {
			return 0;
		}

		const deletePromises = commentsToDelete.map(comment => db.comments.delete(comment.id));
		await Promise.all(deletePromises);

		console.log('✅ Deleted', commentsToDelete.length, 'comments for note:', noteId);
		return commentsToDelete.length;
	} catch (error) {
		console.error('❌ Error deleting comments by note ID:', error);
		throw error;
	}
}

/**
 * Delete a comment by ID
 * @param {Number} commentId - Comment ID
 * @returns {Promise<void>}
 */
async function deleteCommentById(commentId) {
	if (!db) await initDB();

	try {
		await db.comments.delete(commentId);
		console.log('✅ Comment deleted with ID:', commentId);
	} catch (error) {
		console.error('❌ Error deleting comment by ID:', error);
		throw error;
	}
}

/**
 * Update a comment
 * @param {Object} comment - Comment data (must include id)
 * @returns {Promise<Number>} Updated comment ID
 */
async function updateComment(comment) {
	if (!db) await initDB();

	try {
		await db.comments.put(comment);
		console.log('✅ Comment updated with ID:', comment.id);
		return comment.id;
	} catch (error) {
		console.error('❌ Error updating comment:', error);
		throw error;
	}
}

/**
 * Copy comments from one note to another
 * @param {Number} originalNoteId - Source note ID
 * @param {Number} newNoteId - Target note ID
 * @returns {Promise<Number>} Number of comments copied
 */
async function copyComments(originalNoteId, newNoteId) {
	if (!db) await initDB();

	try {
		const comments = await getCommentsByNoteId(originalNoteId);

		if (comments.length === 0) {
			return 0;
		}

		const copyPromises = comments.map(comment => {
			const copiedComment = {
				noteId: newNoteId,
				content: comment.content,
				author: comment.author,
				createdAt: comment.createdAt,
				updatedAt: comment.updatedAt
			};
			return db.comments.add(copiedComment);
		});

		await Promise.all(copyPromises);
		console.log('✅ Copied', comments.length, 'comments to note:', newNoteId);
		return comments.length;
	} catch (error) {
		console.error('❌ Error copying comments:', error);
		throw error;
	}
}

/* ---------- Export Tag Functions ---------- */
window.getAllTags = getAllTags;
window.getTagById = getTagById;
window.checkDuplicateTag = checkDuplicateTag;
window.updateTagById = updateTagById;
window.createTag = createTag;
window.getTagUsageCount = getTagUsageCount;
window.deleteTagById = deleteTagById;
window.removeTagFromAllNotes = removeTagFromAllNotes;

/* ---------- Export Comments Functions ---------- */
window.getCommentsByNoteId = getCommentsByNoteId;
window.saveComment = saveComment;
window.deleteCommentsByNoteId = deleteCommentsByNoteId;
window.deleteCommentById = deleteCommentById;
window.updateComment = updateComment;
window.copyComments = copyComments;

/* ---------- Export Notes Functions ---------- */
window.getNotesWithFilters = getNotesWithFilters;
window.applySorting = applySorting;
window.getAllNotesForCounting = getAllNotesForCounting;
window.getAllNotes = getAllNotes;
window.getNoteById = getNoteById;
window.getCurrentDisplayedNotes = getCurrentDisplayedNotes;
window.getNotesWithReminders = getNotesWithReminders;
window.getSelectableParentNotes = getSelectableParentNotes;

// Notes CRUD
window.createNote = createNote;
window.updateNoteById = updateNoteById;
window.deleteNoteById = deleteNoteById;
window.permanentDeleteNoteById = permanentDeleteNoteById;
window.restoreNoteById = restoreNoteById;
window.archiveNoteById = archiveNoteById;
window.unarchiveNoteById = unarchiveNoteById;
window.toggleNoteFavoriteById = toggleNoteFavoriteById;
window.clearParentNoteReferences = clearParentNoteReferences;
window.clearNoteReminder = clearNoteReminder;

