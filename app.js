// ============================================================================
// APPLICATION STATE
// ============================================================================

let allVideos = [];
let filteredVideos = [];
let currentView = 'grid';

// NOUVELLES VARIABLES : Gestion des tags
let tagsParCategorie = {};
let activeTags = new Set();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CSV_FILE = 'videos_ENRICHI.csv';

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
    loading: document.getElementById('loading'),
    videoGrid: document.getElementById('videoGrid'),
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    categoryFilter: document.getElementById('categoryFilter'),
    intervenantFilter: document.getElementById('intervenantFilter'),
    dateFilter: document.getElementById('dateFilter'),
    sortFilter: document.getElementById('sortFilter'),
    resetFilters: document.getElementById('resetFilters'),
    searchVideosBtn: document.getElementById('searchVideosBtn'),
    activeFilters: document.getElementById('activeFilters'),
    resultsHeader: document.getElementById('resultsHeader'),
    resultsCount: document.getElementById('resultsCount'),
    noResults: document.getElementById('noResults'),
    videoCount: document.getElementById('videoCount'),
    gridView: document.getElementById('gridView'),
    listView: document.getElementById('listView')
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        // Charger les tags
        await chargerTagsCategories();
        
        // Charger les vidéos
        await loadCSV();
        
        // Configurer les event listeners
        setupEventListeners();
        
        // Ne PAS afficher les vidéos au démarrage
        elements.loading.style.display = 'none';
        elements.videoGrid.style.display = 'none';
        elements.resultsHeader.style.display = 'none';
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
        showError('Erreur lors du chargement des données');
    }
}

// ============================================================================
// NOUVELLES FONCTIONS : GESTION DES TAGS
// ============================================================================

/**
 * Charge les tags depuis le fichier JSON
 */
async function chargerTagsCategories() {
    try {
        const response = await fetch('tags_par_categorie.json');
        if (!response.ok) {
            console.warn('Fichier tags_par_categorie.json non trouvé');
            return;
        }
        tagsParCategorie = await response.json();
        console.log(' Tags chargés:', Object.keys(tagsParCategorie).length, 'catégories');
    } catch (error) {
        console.warn('Impossible de charger les tags:', error);
    }
}

/**
 * Affiche le nuage de tags selon les filtres actifs
 */
function afficherNuageTags() {
    const tagsCloudSection = document.getElementById('tagsCloudSection');
    const tagsCloudContainer = document.getElementById('dynamicTagsCloud');
    
    if (!tagsCloudContainer) return;
    
    // Récupérer la catégorie sélectionnée
    const categoryFilter = elements.categoryFilter;
    const selectedCategory = categoryFilter ? categoryFilter.value : '';
    
    // Si aucune catégorie sélectionnée, masquer le nuage
    if (!selectedCategory) {
        tagsCloudSection.style.display = 'none';
        return;
    }
    
    // Récupérer les tags de la catégorie
    const tagsCategorie = tagsParCategorie[selectedCategory];
    
    if (!tagsCategorie || tagsCategorie.length === 0) {
        tagsCloudSection.style.display = 'none';
        return;
    }
    
    // Afficher le nuage
    tagsCloudSection.style.display = 'block';
    tagsCloudContainer.innerHTML = '';
    
    // Calculer les tailles (selon fréquence)
    const maxCount = Math.max(...tagsCategorie.map(t => t.count));
    const minCount = Math.min(...tagsCategorie.map(t => t.count));
    
    // Créer les éléments de tags
    tagsCategorie.forEach(tagInfo => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag-item';
        tagElement.textContent = `${tagInfo.tag}`;
        tagElement.dataset.tag = tagInfo.tag;
        tagElement.title = `Cliquez pour filtrer par "${tagInfo.tag}"`;
        
        // Calculer la taille selon la fréquence
        const ratio = (tagInfo.count - minCount) / (maxCount - minCount || 1);
        if (ratio > 0.8) tagElement.classList.add('tag-size-xl');
        else if (ratio > 0.6) tagElement.classList.add('tag-size-lg');
        else if (ratio > 0.4) tagElement.classList.add('tag-size-md');
        else if (ratio > 0.2) tagElement.classList.add('tag-size-sm');
        else tagElement.classList.add('tag-size-xs');
        
        // Marquer si actif
        if (activeTags.has(tagInfo.tag)) {
            tagElement.classList.add('active');
        }
        
        // vénement clic
        tagElement.addEventListener('click', () => {
            toggleTag(tagInfo.tag);
        });
        
        tagsCloudContainer.appendChild(tagElement);
    });
}

/**
 * Active/désactive un tag
 */
function toggleTag(tag) {
    if (activeTags.has(tag)) {
        activeTags.delete(tag);
    } else {
        activeTags.add(tag);
    }
    
    // Mettre jour l'affichage
    afficherNuageTags();
    applyFilters();
}

/**
 * Réinitialise les tags actifs
 */
function resetActiveTags() {
    activeTags.clear();
    afficherNuageTags();
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadCSV() {
    try {
        const response = await fetch(CSV_FILE);
        const text = await response.text();
        
        // Parse CSV (semicolon-delimited)
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(';').map(h => h.trim());
        
        allVideos = lines.slice(1).map((line, index) => {
            const values = parseCSVLine(line);
            const video = {};
            
            headers.forEach((header, i) => {
                video[header] = values[i] ? values[i].trim() : '';
            });
            
            // Parse numeric values
            video.Vues = parseInt(video.Vues || 0);
            video.Likes = parseInt(video.Likes || 0);
            video.Commentaires = parseInt(video.Commentaires || 0);
            
            // Parse date
            if (video.Date_Publication) {
                const parts = video.Date_Publication.split('/');
                if (parts.length === 3) {
                    video.Date_Parsed = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            }
            
            return video;
        }).filter(v => v.video_id && v.Titre);
        
        elements.videoCount.textContent = `${allVideos.length} vidéos`;
        populateFilters();
        
    } catch (error) {
        console.error('Erreur lors du chargement du CSV:', error);
        throw error;
    }
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ';' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    
    return values;
}

// ============================================================================
// POPULATE FILTERS
// ============================================================================

function populateFilters() {
    // Catégories uniques
    const categories = new Set();
    allVideos.forEach(v => {
        if (v.Categories) {
            v.Categories.split(',').forEach(cat => {
                const trimmed = cat.trim();
                if (trimmed && trimmed !== 'Général') {
                    categories.add(trimmed);
                }
            });
        }
    });
    
    [...categories].sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        elements.categoryFilter.appendChild(option);
    });
    
    // Intervenants uniques
    const intervenants = new Set();
    allVideos.forEach(v => {
        if (v.Intervenants) {
            v.Intervenants.split(',').forEach(interv => {
                const trimmed = interv.trim();
                if (trimmed) {
                    intervenants.add(trimmed);
                }
            });
        }
    });
    
    [...intervenants].sort().forEach(interv => {
        const option = document.createElement('option');
        option.value = interv;
        option.textContent = interv;
        elements.intervenantFilter.appendChild(option);
    });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Search
    elements.searchInput.addEventListener('input', debounce(() => {
        elements.clearSearch.style.display = elements.searchInput.value ? 'block' : 'none';
    }, 300));
    
    elements.clearSearch.addEventListener('click', clearSearch);
    
    // Filters
    elements.searchVideosBtn.addEventListener('click', applyFilters);
    elements.resetFilters.addEventListener('click', resetFilters);
    
    // View toggle
    elements.gridView.addEventListener('click', () => setView('grid'));
    elements.listView.addEventListener('click', () => setView('list'));
    
    // NOUVEAU : Event listener pour le filtre de catégorie (afficher le nuage)
    elements.categoryFilter.addEventListener('change', () => {
        resetActiveTags();
        afficherNuageTags();
    });
    
    // NOUVEAU : Bouton masquer le nuage
    const hideTagsBtn = document.getElementById('hideTagsCloud');
    if (hideTagsBtn) {
        hideTagsBtn.addEventListener('click', () => {
            document.getElementById('tagsCloudSection').style.display = 'none';
        });
    }
    
    // Enter key triggers search
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });
}

// ============================================================================
// FILTERING
// ============================================================================

function applyFilters() {
    elements.loading.style.display = 'block';
    elements.videoGrid.style.display = 'none';
    elements.noResults.style.display = 'none';
    
    setTimeout(() => {
        const filters = {
            searchQuery: elements.searchInput.value.trim().toLowerCase(),
            categoryFilter: elements.categoryFilter.value,
            intervenantFilter: elements.intervenantFilter.value,
            dateFilter: elements.dateFilter.value,
            sortFilter: elements.sortFilter.value
        };
        
        let filtered = filterVideos(filters);
        sortVideos(filtered, filters.sortFilter);
        updateActiveFilters(filters);
        displayVideos(filtered);
    }, 100);
}

function filterVideos(filters) {
    let filtered = [...allVideos];
    
    // Search query
    if (filters.searchQuery) {
        filtered = filtered.filter(video => {
            const searchFields = [
                video.Titre,
                video.Description,
                video.Tags,
                video.Categories,
                video.Intervenants
            ].map(f => (f || '').toLowerCase());
            
            return searchFields.some(field => field.includes(filters.searchQuery));
        });
    }
    
    // Category filter
    if (filters.categoryFilter) {
        filtered = filtered.filter(video => {
            const categories = video.Categories || '';
            return categories.includes(filters.categoryFilter);
        });
    }
    
    // NOUVEAU : Filtrer par tags actifs
    if (activeTags.size > 0) {
        console.log(' Tags actifs:', Array.from(activeTags));
        
        filtered = filtered.filter(video => {
            // Récupérer tous les tags de la vidéo (en priorité Tags_Fusionnes, sinon Tags)
            const videoTagsStr = (video.Tags_Fusionnes || video.Tags || '').toLowerCase();
            
            // Séparer les tags par virgules et nettoyer
            const videoTagsArray = videoTagsStr
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
            
            // Vérifier si la vidéo contient AU MOINS UN des tags actifs
            // Utiliser une correspondance de mot entier pour éviter les faux positifs
            const matches = Array.from(activeTags).some(activeTag => {
                const activeTagLower = activeTag.toLowerCase();
                return videoTagsArray.some(videoTag => {
                    // Correspondance exacte OU le tag vidéo contient le tag actif comme mot entier
                    return videoTag === activeTagLower || 
                           videoTag.includes(' ' + activeTagLower + ' ') ||
                           videoTag.startsWith(activeTagLower + ' ') ||
                           videoTag.endsWith(' ' + activeTagLower);
                });
            });
            
            return matches;
        });
        
        console.log(` Vidéos filtrées par tags: ${filtered.length} résultats`);
    }
    
    // Intervenant filter
    if (filters.intervenantFilter) {
        filtered = filtered.filter(video => {
            const intervenants = video.Intervenants || '';
            return intervenants.includes(filters.intervenantFilter);
        });
    }
    
    // Date filter
    if (filters.dateFilter && filters.dateFilter !== '') {
        const now = new Date();
        let cutoffDate = new Date();
        
        switch(filters.dateFilter) {
            case 'week':
                cutoffDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                cutoffDate.setMonth(now.getMonth() - 1);
                break;
            case '3months':
                cutoffDate.setMonth(now.getMonth() - 3);
                break;
            case '6months':
                cutoffDate.setMonth(now.getMonth() - 6);
                break;
            case 'year':
                cutoffDate.setFullYear(now.getFullYear() - 1);
                break;
            case 'last-year':
                cutoffDate = new Date(now.getFullYear() - 1, 0, 1);
                const endDate = new Date(now.getFullYear() - 1, 11, 31);
                filtered = filtered.filter(video => {
                    if (!video.Date_Parsed) return false;
                    return video.Date_Parsed >= cutoffDate && video.Date_Parsed <= endDate;
                });
                return filtered;
        }
        
        filtered = filtered.filter(video => {
            if (!video.Date_Parsed) return false;
            return video.Date_Parsed >= cutoffDate;
        });
    }
    
    return filtered;
}

function clearSearch() {
    elements.searchInput.value = '';
    elements.clearSearch.style.display = 'none';
}

// ============================================================================
// SORTING
// ============================================================================

function sortVideos(videos, sortBy) {
    switch(sortBy) {
        case 'date-desc':
            videos.sort((a, b) => {
                if (!a.Date_Parsed) return 1;
                if (!b.Date_Parsed) return -1;
                return b.Date_Parsed - a.Date_Parsed;
            });
            break;
        case 'date-asc':
            videos.sort((a, b) => {
                if (!a.Date_Parsed) return 1;
                if (!b.Date_Parsed) return -1;
                return a.Date_Parsed - b.Date_Parsed;
            });
            break;
        case 'views-desc':
            videos.sort((a, b) => b.Vues - a.Vues);
            break;
        case 'views-asc':
            videos.sort((a, b) => a.Vues - b.Vues);
            break;
        case 'title-asc':
            videos.sort((a, b) => (a.Titre || '').localeCompare(b.Titre || ''));
            break;
        case 'title-desc':
            videos.sort((a, b) => (b.Titre || '').localeCompare(a.Titre || ''));
            break;
        case 'duration-desc':
            videos.sort((a, b) => parseDuration(b.Duree) - parseDuration(a.Duree));
            break;
        case 'duration-asc':
            videos.sort((a, b) => parseDuration(a.Duree) - parseDuration(b.Duree));
            break;
        default:
            break;
    }
}

function parseDuration(duration) {
    if (!duration) return 0;
    const parts = duration.split(':').map(p => parseInt(p) || 0);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

// ============================================================================
// ACTIVE FILTERS DISPLAY
// ============================================================================

function updateActiveFilters(filters) {
    elements.activeFilters.innerHTML = '';
    
    if (filters.searchQuery) {
        addFilterTag('Recherche', filters.searchQuery, () => clearSearch());
    }
    
    if (filters.categoryFilter) {
        addFilterTag('Catégorie', filters.categoryFilter, () => {
            elements.categoryFilter.value = '';
            applyFilters();
        });
    }
    
    if (filters.intervenantFilter) {
        addFilterTag('Intervenant', filters.intervenantFilter, () => {
            elements.intervenantFilter.value = '';
            applyFilters();
        });
    }
    
    if (filters.dateFilter) {
        const dateLabels = {
            'week': 'Cette semaine',
            'month': 'Ce mois-ci',
            '3months': '3 derniers mois',
            '6months': '6 derniers mois',
            'year': 'Cette année',
            'last-year': 'Année dernière'
        };
        addFilterTag('Date', dateLabels[filters.dateFilter] || filters.dateFilter, () => {
            elements.dateFilter.value = '';
            applyFilters();
        });
    }
}

function addFilterTag(label, value, onRemove) {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `
        <span>${label}: ${value}</span>
        <button onclick="event.preventDefault()">×</button>
    `;
    tag.querySelector('button').addEventListener('click', onRemove);
    elements.activeFilters.appendChild(tag);
}

// ============================================================================
// RESET FILTERS
// ============================================================================

function resetFilters() {
    elements.searchInput.value = '';
    elements.categoryFilter.value = '';
    elements.intervenantFilter.value = '';
    elements.dateFilter.value = '';
    elements.sortFilter.value = 'date-desc';
    clearSearch();
    resetActiveTags(); // NOUVEAU : Réinitialiser les tags
}

// ============================================================================
// DISPLAY VIDEOS
// ============================================================================

function displayVideos(videos) {
    elements.loading.style.display = 'none';
    elements.resultsHeader.style.display = 'flex';
    
    if (videos.length === 0) {
        elements.videoGrid.style.display = 'none';
        elements.noResults.style.display = 'block';
        elements.resultsCount.textContent = '0 résultat';
        return;
    }
    
    elements.noResults.style.display = 'none';
    elements.videoGrid.style.display = 'grid';
    elements.resultsCount.textContent = `${videos.length} résultat${videos.length > 1 ? 's' : ''}`;
    
    elements.videoGrid.innerHTML = videos.map(video => createVideoCard(video)).join('');
}

// ============================================================================
// CREATE VIDEO CARD
// ============================================================================

function createVideoCard(video) {
    const views = formatNumber(video.Vues || 0);
    const duration = formatDuration(video.Duree);
    const date = video.Date_Publication || '';
    
    // Extraire catégories (limiter 3)
    const categories = video.Categories ? 
        video.Categories.split(',').map(c => c.trim()).filter(c => c && c !== 'Général').slice(0, 3) : [];
    
    // Extraire intervenant principal
    const intervenant = video.Intervenants ? 
        video.Intervenants.split(',')[0].trim() : '';
    
    // Extraire et nettoyer la description (150 caractères max)
    let description = '';
    if (video.Description) {
        description = video.Description
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/<[^>]*>/g, '')
            .trim();
        
        if (description.length > 150) {
            description = description.substring(0, 150);
            const lastSpace = description.lastIndexOf(' ');
            if (lastSpace > 0) {
                description = description.substring(0, lastSpace);
            }
            description += '...';
        }
    }
    
    return `
        <div class="video-card">
            <div class="video-thumbnail">
                ${video.Thumbnail ? 
                    `<img src="${video.Thumbnail}" alt="${escapeHtml(video.Titre)}" class="thumbnail-img" loading="lazy">` : 
                    '<div class="thumbnail-placeholder"></div>'
                }
                ${duration ? `<div class="video-duration">${duration}</div>` : ''}
            </div>
            <div class="video-content">
                <div class="video-header">
                    <span class="video-id">${video.video_id || ''}</span>
                    ${date ? `<span class="video-date">${date}</span>` : ''}
                </div>
                
                <h3 class="video-title">${escapeHtml(video.Titre)}</h3>
                
                ${intervenant ? `<div class="video-intervenant">${escapeHtml(intervenant)}</div>` : ''}
                
                ${description ? `<p class="video-description">${escapeHtml(description)}</p>` : ''}
                
                <div class="video-meta">
                    ${views > 0 ? `<span class="meta-item">ï ${views} vues</span>` : ''}
                    ${video.Likes > 0 ? `<span class="meta-item">${formatNumber(video.Likes)} likes</span>` : ''}
                </div>
                
                ${categories.length > 0 ? `
                <div class="video-categories">
                    ${categories.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join('')}
                </div>
                ` : ''}
                
                <div class="video-actions">
                    <a href="${video.URL}" target="_blank" rel="noopener noreferrer" class="watch-btn">
                        Voir sur YouTube
                    </a>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatDuration(duration) {
    if (!duration) return '';
    const parts = duration.split(':');
    if (parts.length === 3) {
        const h = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        if (h > 0) return `${h}h${m}min`;
        return `${m}min`;
    } else if (parts.length === 2) {
        const m = parseInt(parts[0]);
        return `${m}min`;
    }
    return duration;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setView(view) {
    currentView = view;
    elements.videoGrid.className = view === 'list' ? 'video-grid list-view' : 'video-grid';
    elements.gridView.classList.toggle('active', view === 'grid');
    elements.listView.classList.toggle('active', view === 'list');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showError(message) {
    elements.loading.style.display = 'none';
    elements.videoGrid.innerHTML = `
        <div class="no-results">
            <div class="no-results-icon">âï</div>
            <h3>Erreur</h3>
            <p>${message}</p>
        </div>
    `;
}
