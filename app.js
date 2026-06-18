/**
 * app.js — Mayurbhanj Tourist Leaflet Map Application
 * Interactive map with sidebar, filtering, search, and modal details
 */

/* =============================================
   STATE
   ============================================= */
let map;
let markers = {};
let activeCardId = null;
let currentFilter = 'all';
let currentSearch = '';
let sidebarOpen = true;
let currentBasemap = 'dark';
let activeLayer = null;

// ---- Routing State Variables ----
let routingModeActive = false;
let routeDestinationSpot = null;
let routeStartCoords = null; // [lat, lng]
let routeStartLabel = '';
let routePolyline = null;
let routeShadowPolyline = null;
let startMarker = null;
let mapClickListener = null;

// ---- Basemap Tile Definitions ----
const BASEMAPS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19,
    },
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, GIS User Community',
      maxZoom: 19,
    },
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    opts: {
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      subdomains: 'abc', maxZoom: 17,
    },
  },
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    opts: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19,
    },
  },
};

/* =============================================
   MAP INITIALIZATION
   ============================================= */
function initMap() {
  // Initialize Leaflet map centered on Mayurbhanj
  map = L.map('map', {
    center: [21.82, 86.55],
    zoom: 10,
    zoomControl: false,
    attributionControl: true,
  });

  // Add default basemap (Dark)
  const bm = BASEMAPS['dark'];
  activeLayer = L.tileLayer(bm.url, bm.opts).addTo(map);

  // Custom zoom control position
  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  // Draw district boundary highlight (approximate polygon for Mayurbhanj)
  drawDistrictBoundary();

  // Add all markers
  TOURIST_SPOTS.forEach(spot => addMarker(spot));

  // Update sidebar
  renderSidebarCards(TOURIST_SPOTS);
  updateVisibleCount(TOURIST_SPOTS.length);

  // On mobile, start with sidebar collapsed (hidden) so map is visible
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.add('collapsed');
      sidebar.classList.remove('hidden');
    }
    sidebarOpen = false;
    // Initialize bottom sheet dragging gestures
    initBottomSheetDrag();
  }

  // Sync the toggle icon with the sidebar state
  const icon = document.getElementById('toggleIcon');
  if (icon) {
    icon.className = sidebarOpen ? 'fas fa-times' : 'fas fa-bars';
  }
}

/* =============================================
   DISTRICT BOUNDARY
   ============================================= */
function drawDistrictBoundary() {
  // Approximate bounding polygon for Mayurbhanj district
  const mayurbhanjBounds = [
    [22.57, 85.95], [22.50, 86.30], [22.38, 86.70], [22.20, 87.00],
    [22.00, 87.10], [21.80, 87.05], [21.55, 86.90], [21.35, 86.70],
    [21.20, 86.45], [21.25, 86.10], [21.40, 85.85], [21.65, 85.75],
    [21.90, 85.78], [22.20, 85.88], [22.57, 85.95],
  ];

  L.polygon(mayurbhanjBounds, {
    color: '#22c55e',
    weight: 2,
    opacity: 0.5,
    fillColor: '#22c55e',
    fillOpacity: 0.04,
    dashArray: '6 4',
  }).addTo(map).bindTooltip('Mayurbhanj District, Odisha', {
    permanent: false,
    className: 'district-tooltip',
    direction: 'center',
  });
}

/* =============================================
   MARKER CREATION
   ============================================= */
function getMarkerColor(category) {
  const meta = CATEGORY_META[category];
  return meta ? meta.color : '#22c55e';
}

function createCustomIcon(spot) {
  const color = getMarkerColor(spot.category);
  const meta = CATEGORY_META[spot.category];
  const faIcon = meta ? meta.icon : 'fa-map-pin';

  const html = `
    <div class="custom-marker">
      <div class="marker-pin" style="background: linear-gradient(135deg, ${color}, ${color}99);">
        <i class="fas ${faIcon}" style="font-size:13px;"></i>
      </div>
      <div class="marker-pulse" style="background: ${color};"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [40, 48],
    iconAnchor: [20, 46],
    popupAnchor: [0, -46],
  });
}

function addMarker(spot) {
  const icon = createCustomIcon(spot);
  const marker = L.marker([spot.lat, spot.lng], { icon })
    .addTo(map)
    .bindPopup(createPopupContent(spot), {
      maxWidth: 240,
      minWidth: 220,
      closeButton: true,
      className: 'custom-popup',
    });

  marker.on('click', () => {
    setActiveCard(spot.id);
    marker.openPopup();
    scrollToCard(spot.id);
  });

  marker.on('popupopen', () => setActiveCard(spot.id));
  marker.on('popupclose', () => {
    if (activeCardId === spot.id) clearActiveCard();
  });

  markers[spot.id] = marker;
}

function createPopupContent(spot) {
  const meta = CATEGORY_META[spot.category];
  const color = meta ? meta.color : '#22c55e';
  const label = meta ? meta.label : spot.category;

  return `
    <div class="popup-content">
      <div class="popup-img-wrap">
        <img
          class="popup-img"
          src="${spot.image}"
          alt="${spot.name}"
          onerror="this.style.display='none'"
        />
        <div class="popup-img-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${label}</div>
      </div>
      <div class="popup-body">
        <div class="popup-name">${spot.name}</div>
        <div class="popup-desc">${spot.shortDesc}</div>
        <button class="popup-btn" onclick="openModal(${spot.id})">
          <i class="fas fa-info-circle"></i> View Details
        </button>
      </div>
    </div>
  `;
}

/* =============================================
   SIDEBAR RENDERING
   ============================================= */
function renderSidebarCards(spots) {
  const list = document.getElementById('spotsList');
  const countEl = document.getElementById('spotCount');

  list.innerHTML = '';
  countEl.textContent = `${spots.length} place${spots.length !== 1 ? 's' : ''}`;
  updateVisibleCount(spots.length);

  if (spots.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-map-location-dot"></i>
        <p>No spots found</p>
      </div>
    `;
    return;
  }

  spots.forEach((spot, idx) => {
    const meta = CATEGORY_META[spot.category];
    const color = meta ? meta.color : '#22c55e';
    const label = meta ? meta.label : spot.category;

    const card = document.createElement('div');
    card.className = `spot-card${activeCardId === spot.id ? ' active' : ''}`;
    card.id = `card-${spot.id}`;
    card.style.animationDelay = `${idx * 30}ms`;
    card.style.setProperty('--cat-color', color);
    card.onclick = (e) => {
      if (e.target.closest('.spot-view-btn') || e.target.closest('.spot-dir-btn')) return;
      flyToSpot(spot);
    };

    card.innerHTML = `
      <div class="spot-card-top">
        <div class="spot-thumb-wrap">
          <img
            class="spot-thumb-img"
            src="${spot.image}"
            alt="${spot.name}"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          />
          <div class="spot-thumb-fallback cat-${spot.category}" style="display:none;font-size:20px;">${spot.emoji}</div>
          <div class="spot-thumb-cat-dot" style="background:${color}"></div>
        </div>
        <div class="spot-card-info">
          <div class="spot-card-name">${spot.name}</div>
          <div class="spot-card-loc">
            <i class="fas fa-location-dot" style="color:${color};font-size:10px;"></i>
            ${spot.location}
          </div>
        </div>
      </div>
      <div class="spot-card-bottom">
        <div class="spot-card-tags">
          <span class="spot-tag cat-${spot.category}">${label}</span>
        </div>
        <div class="spot-card-actions" style="display:flex;gap:6px;">
          <button class="spot-dir-btn" onclick="startDirections(${spot.id}, event)">
            <i class="fas fa-route"></i> Route
          </button>
          <button class="spot-view-btn" onclick="openModal(${spot.id})">
            <i class="fas fa-eye"></i> View
          </button>
        </div>
      </div>
    `;

    list.appendChild(card);
  });
}

/* =============================================
   FILTERING & SEARCH
   ============================================= */
function filterSpots(cat) {
  currentFilter = cat;

  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });

  applyFilters();
}

function searchSpots(query) {
  currentSearch = query.toLowerCase();
  applyFilters();
}

function applyFilters() {
  let filtered = TOURIST_SPOTS.filter(spot => {
    const catMatch = currentFilter === 'all' || spot.category === currentFilter;
    const searchMatch = !currentSearch ||
      spot.name.toLowerCase().includes(currentSearch) ||
      spot.location.toLowerCase().includes(currentSearch) ||
      spot.shortDesc.toLowerCase().includes(currentSearch) ||
      spot.tags.some(t => t.toLowerCase().includes(currentSearch));
    return catMatch && searchMatch;
  });

  // Show/hide markers
  TOURIST_SPOTS.forEach(spot => {
    const marker = markers[spot.id];
    const isVisible = filtered.find(s => s.id === spot.id);
    if (isVisible) {
      if (!map.hasLayer(marker)) map.addLayer(marker);
    } else {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    }
  });

  renderSidebarCards(filtered);

  // Fit bounds to visible markers
  if (filtered.length > 0) {
    const bounds = filtered.map(s => [s.lat, s.lng]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }
}

/* =============================================
   MAP INTERACTION
   ============================================= */
function flyToSpot(spot) {
  map.flyTo([spot.lat, spot.lng], 13, { duration: 1.2, easeLinearity: 0.5 });

  // On mobile, auto-collapse bottom sheet to peek state so map is visible
  if (window.innerWidth <= 768) {
    collapseSidebar();
  }

  setTimeout(() => {
    const marker = markers[spot.id];
    if (marker) {
      marker.openPopup();
      // Bounce animation
      const el = marker.getElement();
      if (el) {
        const pin = el.querySelector('.marker-pin');
        if (pin) {
          pin.classList.add('bounce');
          setTimeout(() => pin.classList.remove('bounce'), 1600);
        }
      }
    }
  }, 1200);

  setActiveCard(spot.id);
}

function setActiveCard(id) {
  // Remove previous active
  if (activeCardId) {
    const prev = document.getElementById(`card-${activeCardId}`);
    if (prev) prev.classList.remove('active');
  }
  activeCardId = id;
  const curr = document.getElementById(`card-${id}`);
  if (curr) curr.classList.add('active');
  scrollToCard(id);
}

function clearActiveCard() {
  if (activeCardId) {
    const card = document.getElementById(`card-${activeCardId}`);
    if (card) card.classList.remove('active');
  }
  activeCardId = null;
}

function scrollToCard(id) {
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function updateVisibleCount(n) {
  const el = document.getElementById('visibleCount');
  if (el) el.textContent = n;
}


/* =============================================
   MODAL
   ============================================= */
function openModal(id) {
  const spot = TOURIST_SPOTS.find(s => s.id === id);
  if (!spot) return;

  const meta = CATEGORY_META[spot.category];
  const color = meta ? meta.color : '#22c55e';
  const bg = meta ? meta.bg : 'rgba(34,197,94,0.15)';
  const label = meta ? meta.label : spot.category;

  document.getElementById('modalTitle').textContent = spot.name;
  document.getElementById('modalDesc').textContent = spot.description;
  document.getElementById('modalLocation').innerHTML = `<i class="fas fa-map-pin"></i> ${spot.location}`;
  document.getElementById('modalDist').innerHTML = `<i class="fas fa-route"></i> ${spot.distance}`;

  // Badge
  const badge = document.getElementById('modalBadge');
  badge.textContent = label;
  badge.style.background = bg;
  badge.style.color = color;
  badge.style.border = `1px solid ${color}44`;

  // Real image in modal hero
  const placeholder = document.getElementById('modalImgPlaceholder');
  placeholder.innerHTML = `
    <img
      src="${spot.image}"
      alt="${spot.name}"
      class="modal-hero-img"
      onerror="this.style.display='none';document.getElementById('modalImgFallback').style.display='flex'"
    />
    <div id="modalImgFallback" class="modal-img-fallback" style="display:none;background:linear-gradient(135deg,${bg},${bg.replace('0.15','0.05')})">
      <span style="font-size:64px;filter:drop-shadow(0 4px 20px ${color}88)">${spot.emoji}</span>
    </div>
  `;
  placeholder.style.background = 'transparent';

  // Details grid
  const details = document.getElementById('modalDetails');
  details.innerHTML = `
    <div class="detail-item">
      <div class="detail-label">Best Time to Visit</div>
      <div class="detail-value">${spot.bestTime}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Entry Fee</div>
      <div class="detail-value">${spot.entryFee}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Category</div>
      <div class="detail-value" style="color:${color}">${label}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Highlight</div>
      <div class="detail-value" style="font-size:11px;">${spot.highlight}</div>
    </div>
  `;

  // Directions link
  const dirBtn = document.getElementById('modalDirections');
  dirBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

  // Show modal
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('spotModal').classList.add('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.getElementById('spotModal').classList.remove('show');
}

// Close modal on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* =============================================
   BASEMAP SWITCHER
   ============================================= */
function switchBasemap(id) {
  if (id === currentBasemap) return;

  const bm = BASEMAPS[id];
  if (!bm) return;

  // Remove current layer
  if (activeLayer) map.removeLayer(activeLayer);

  // Add new layer at the bottom
  activeLayer = L.tileLayer(bm.url, bm.opts);
  activeLayer.addTo(map);
  activeLayer.bringToBack();

  currentBasemap = id;

  // Update button states
  document.querySelectorAll('.basemap-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-${id}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Adjust marker boundary line color for light basemaps
  const isLight = (id === 'streets' || id === 'topo');
  document.documentElement.style.setProperty(
    '--boundary-opacity', isLight ? '0.7' : '0.5'
  );
}

/* =============================================
   MOBILE BOTTOM SHEET HELPER FUNCTIONS
   ============================================= */
function expandSidebar() {
  const sidebar = document.getElementById('sidebar');
  const icon = document.getElementById('toggleIcon');
  const overlay = document.getElementById('sidebarOverlay');
  const isMobile = window.innerWidth <= 768;

  sidebarOpen = true;
  if (sidebar) {
    sidebar.classList.remove('collapsed');
    sidebar.classList.remove('hidden');
    sidebar.style.transform = ''; // Clear inline dragging styles
  }

  if (icon) icon.className = 'fas fa-times';

  if (isMobile && overlay) {
    overlay.classList.add('show');
  }

  setTimeout(() => map.invalidateSize(), 350);
}

function collapseSidebar() {
  const sidebar = document.getElementById('sidebar');
  const icon = document.getElementById('toggleIcon');
  const overlay = document.getElementById('sidebarOverlay');

  sidebarOpen = false;
  if (sidebar) {
    sidebar.classList.add('collapsed');
    sidebar.classList.remove('hidden');
    sidebar.style.transform = ''; // Clear inline dragging styles
  }

  if (icon) icon.className = 'fas fa-bars';

  if (overlay) {
    overlay.classList.remove('show');
  }

  setTimeout(() => map.invalidateSize(), 350);
}

function hideSidebar() {
  const sidebar = document.getElementById('sidebar');
  const icon = document.getElementById('toggleIcon');
  const overlay = document.getElementById('sidebarOverlay');

  sidebarOpen = false;
  if (sidebar) {
    sidebar.classList.add('collapsed');
    sidebar.classList.add('hidden');
    sidebar.style.transform = ''; // Clear inline dragging styles
  }

  if (icon) icon.className = 'fas fa-bars';

  if (overlay) {
    overlay.classList.remove('show');
  }

  setTimeout(() => map.invalidateSize(), 350);
}

function handleCloseBtnClick(e) {
  if (e) e.stopPropagation();
  const sidebar = document.getElementById('sidebar');
  const isMobile = window.innerWidth <= 768;

  if (isMobile && sidebar) {
    if (sidebar.classList.contains('collapsed')) {
      // If already collapsed (peeking), hide it completely
      hideSidebar();
    } else {
      // If expanded, collapse it to peeking
      collapseSidebar();
    }
  } else {
    // Desktop: collapse
    collapseSidebar();
  }
}

let startY = 0;
let isDragging = false;
let sidebarHeight = 0;

function initBottomSheetDrag() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const handle = sidebar.querySelector('.bottom-sheet-drag-handle');
  const header = sidebar.querySelector('.sidebar-header');

  const getPeekHeight = () => {
    const peekStr = getComputedStyle(document.documentElement).getPropertyValue('--peek-h').trim();
    return parseInt(peekStr) || 68;
  };

  const onTouchStart = (e) => {
    startY = e.touches[0].clientY;
    sidebarHeight = sidebar.getBoundingClientRect().height;
    sidebar.style.transition = 'none'; // Disable transition during drag
    isDragging = true;
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    const clientY = e.touches[0].clientY;
    const deltaY = clientY - startY;
    const peekH = getPeekHeight();

    if (sidebar.classList.contains('collapsed')) {
      // In collapsed state, translate is down by (height - peekH)
      const maxTranslate = sidebarHeight - peekH;
      const currentTranslate = maxTranslate + deltaY;
      const clampedTranslate = Math.max(0, Math.min(maxTranslate, currentTranslate));
      sidebar.style.transform = `translateY(${clampedTranslate}px)`;
    } else {
      // In expanded state, translate is 0
      const clampedTranslate = Math.max(0, Math.min(sidebarHeight, deltaY));
      sidebar.style.transform = `translateY(${clampedTranslate}px)`;
    }
  };

  const onTouchEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    sidebar.style.transition = ''; // Restore CSS transition

    const endY = e.changedTouches[0].clientY;
    const deltaY = endY - startY;

    if (sidebar.classList.contains('collapsed')) {
      if (deltaY < -50) {
        expandSidebar();
      } else {
        collapseSidebar();
      }
    } else {
      if (deltaY > 80) {
        collapseSidebar();
      } else {
        expandSidebar();
      }
    }
  };

  const onHeaderClick = (e) => {
    // Prevent toggling if user clicks on interactive elements (like buttons or selects)
    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) {
      return;
    }
    toggleSidebar();
  };

  [handle, header].forEach(el => {
    if (!el) return;
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('click', onHeaderClick);
  });
}

/* =============================================
   SIDEBAR TOGGLE
   ============================================= */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  if (sidebar.classList.contains('collapsed') || sidebar.classList.contains('hidden')) {
    expandSidebar();
  } else {
    collapseSidebar();
  }
}

/* =============================================
   MOBILE BASEMAP SWITCHER TOGGLE
   ============================================= */
function toggleBasemapSwitcher(e) {
  if (window.innerWidth > 768) return;
  const switcher = document.getElementById('basemapSwitcher');
  if (!switcher) return;
  
  if (e.target.closest('.basemap-btn')) {
    // Allow change to complete, then collapse
    setTimeout(() => switcher.classList.remove('expanded'), 150);
    return;
  }
  
  e.stopPropagation();
  switcher.classList.toggle('expanded');
}

document.addEventListener('click', () => {
  const switcher = document.getElementById('basemapSwitcher');
  if (switcher) switcher.classList.remove('expanded');
});

/* =============================================
   DIRECTIONS & ROUTING LOGIC
   ============================================= */
function startDirections(spotId, event) {
  if (event) {
    event.stopPropagation();
  }

  // Close active popup if open
  map.closePopup();

  routingModeActive = true;
  routeDestinationSpot = TOURIST_SPOTS.find(s => s.id === spotId);
  if (!routeDestinationSpot) return;

  // Update destination label in UI
  document.getElementById('routeDestination').textContent = routeDestinationSpot.name;

  // Toggle views in sidebar
  document.getElementById('spotsListView').style.display = 'none';
  document.getElementById('directionsView').style.display = 'flex';

  // Set default selection to Baripada
  const originSelect = document.getElementById('routeOrigin');
  originSelect.value = 'baripada';
  
  // Make sure sidebar is expanded
  if (!sidebarOpen) {
    expandSidebar();
  }

  // Start calculating from default
  handleOriginChange('baripada');
}

function closeDirections() {
  routingModeActive = false;
  routeDestinationSpot = null;
  routeStartCoords = null;
  routeStartLabel = '';

  // Clear map layers
  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }
  if (routeShadowPolyline) {
    map.removeLayer(routeShadowPolyline);
    routeShadowPolyline = null;
  }
  if (startMarker) {
    map.removeLayer(startMarker);
    startMarker = null;
  }

  // Disable click on map listener
  if (mapClickListener) {
    map.off('click', mapClickListener);
    mapClickListener = null;
  }

  // Hide UI overlays & helper banner
  document.getElementById('mapHelperBanner').style.display = 'none';
  document.getElementById('routeResultCard').style.display = 'none';
  document.getElementById('routeStatus').style.display = 'none';
  document.getElementById('routeInstructions').innerHTML = '<div class="instructions-placeholder">Select a start location to calculate instructions.</div>';

  // Toggle views in sidebar
  document.getElementById('spotsListView').style.display = 'flex';
  document.getElementById('directionsView').style.display = 'none';

  // Fly back to general Mayurbhanj view or fit all spots bounds
  const bounds = TOURIST_SPOTS.map(s => [s.lat, s.lng]);
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });

  map.invalidateSize();
}

function startInAppDirectionsFromModal() {
  closeModal();
  if (activeCardId) {
    startDirections(activeCardId);
  }
}

function handleOriginChange(val) {
  // Reset existing markers, paths, listeners, banners
  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }
  if (routeShadowPolyline) {
    map.removeLayer(routeShadowPolyline);
    routeShadowPolyline = null;
  }
  if (startMarker) {
    map.removeLayer(startMarker);
    startMarker = null;
  }
  if (mapClickListener) {
    map.off('click', mapClickListener);
    mapClickListener = null;
  }
  document.getElementById('mapHelperBanner').style.display = 'none';
  document.getElementById('routeResultCard').style.display = 'none';
  document.getElementById('routeStatus').style.display = 'none';
  document.getElementById('routeInstructions').innerHTML = '<div class="instructions-placeholder">Select a start location to calculate instructions.</div>';

  if (val === 'baripada') {
    routeStartCoords = [21.9329, 86.7319];
    routeStartLabel = 'Baripada City';
    calculateRoute();
  } else if (val === 'rairangpur') {
    routeStartCoords = [22.2686, 86.1758];
    routeStartLabel = 'Rairangpur';
    calculateRoute();
  } else if (val === 'karanjia') {
    routeStartCoords = [21.7770, 85.9712];
    routeStartLabel = 'Karanjia';
    calculateRoute();
  } else if (val === 'udala') {
    routeStartCoords = [21.5796, 86.5684];
    routeStartLabel = 'Udala';
    calculateRoute();
  } else if (val === 'gps') {
    getGPSLocation();
  } else if (val === 'map') {
    setupMapClickListener();
  }
}

function setupMapClickListener() {
  document.getElementById('mapHelperBanner').style.display = 'flex';

  mapClickListener = function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    routeStartCoords = [lat, lng];
    routeStartLabel = `Pin Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

    document.getElementById('mapHelperBanner').style.display = 'none';
    map.off('click', mapClickListener);
    mapClickListener = null;

    calculateRoute();
  };

  map.on('click', mapClickListener);
}

function getGPSLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    document.getElementById('routeOrigin').value = 'baripada';
    handleOriginChange('baripada');
    return;
  }

  const statusEl = document.getElementById('routeStatus');
  const statusTextEl = document.getElementById('routeStatusText');
  
  statusEl.style.display = 'flex';
  statusTextEl.textContent = 'Requesting GPS location...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      routeStartCoords = [lat, lng];
      routeStartLabel = 'My Location';
      calculateRoute();
    },
    (error) => {
      console.warn("Geolocation error:", error);
      let errMsg = "Unable to retrieve your location.";
      if (error.code === error.PERMISSION_DENIED) {
        errMsg = "GPS permission denied by user.";
      }
      alert(errMsg + " Reverting to Baripada.");
      document.getElementById('routeOrigin').value = 'baripada';
      handleOriginChange('baripada');
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
  );
}

function calculateRoute() {
  if (!routeStartCoords || !routeDestinationSpot) return;

  const statusEl = document.getElementById('routeStatus');
  const statusTextEl = document.getElementById('routeStatusText');
  statusEl.style.display = 'flex';
  statusTextEl.textContent = 'Calculating road route...';
  document.getElementById('routeResultCard').style.display = 'none';

  const startLng = routeStartCoords[1];
  const startLat = routeStartCoords[0];
  const endLng = routeDestinationSpot.lng;
  const endLat = routeDestinationSpot.lat;

  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("Network response not ok");
      return response.json();
    })
    .then(data => {
      statusEl.style.display = 'none';
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1);
        
        // Travel time formatting
        const durationSec = route.duration;
        let timeStr = '';
        if (durationSec < 60) {
          timeStr = '1 min';
        } else {
          const mins = Math.round(durationSec / 60);
          if (mins < 60) {
            timeStr = `${mins} mins`;
          } else {
            const hrs = Math.floor(mins / 60);
            const remainingMins = mins % 60;
            timeStr = `${hrs} hr ${remainingMins} min${remainingMins !== 1 ? 's' : ''}`;
          }
        }

        // Update UI metrics
        document.getElementById('routeDistance').textContent = `${distanceKm} km`;
        document.getElementById('routeDuration').textContent = timeStr;
        document.getElementById('routeResultCard').style.display = 'block';

        // Render on map
        drawRouteOnMap(route.geometry, false);

        // Turn-by-turn steps
        renderInstructions(route.legs[0].steps);
      } else {
        throw new Error("Invalid OSRM route data");
      }
    })
    .catch(err => {
      console.warn("OSRM routing failed, reverting to straight-line:", err);
      statusEl.style.display = 'none';
      calculateStraightLineFallback();
    });
}

function calculateStraightLineFallback() {
  const startLatLng = L.latLng(routeStartCoords[0], routeStartCoords[1]);
  const endLatLng = L.latLng(routeDestinationSpot.lat, routeDestinationSpot.lng);
  
  // Straight line distance
  const distanceMeters = startLatLng.distanceTo(endLatLng);
  // Estimate road winding factor of ~1.25
  const estRoadDistanceKm = ((distanceMeters * 1.25) / 1000).toFixed(1);

  // Estimate travel time at 50 km/h average speed
  const speedKmh = 50;
  const durationHrs = parseFloat(estRoadDistanceKm) / speedKmh;
  const durationSec = durationHrs * 3600;
  
  let timeStr = '';
  if (durationSec < 60) {
    timeStr = '1 min';
  } else {
    const mins = Math.round(durationSec / 60);
    if (mins < 60) {
      timeStr = `${mins} mins`;
    } else {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      timeStr = `${hrs} hr ${remainingMins} min${remainingMins !== 1 ? 's' : ''}`;
    }
  }

  // Update UI metrics
  document.getElementById('routeDistance').textContent = `${estRoadDistanceKm} km`;
  document.getElementById('routeDuration').textContent = `${timeStr} (Est.)`;
  document.getElementById('routeResultCard').style.display = 'block';

  // Draw straight line on map
  const fallbackGeometry = {
    type: "LineString",
    coordinates: [
      [routeStartCoords[1], routeStartCoords[0]],
      [routeDestinationSpot.lng, routeDestinationSpot.lat]
    ]
  };
  
  drawRouteOnMap(fallbackGeometry, true);

  // Generate generic instructions
  const container = document.getElementById('routeInstructions');
  container.innerHTML = `
    <div class="instruction-item">
      <div class="instruction-icon"><i class="fas fa-circle-dot"></i></div>
      <div class="instruction-details">
        <div>Depart from: ${routeStartLabel}</div>
      </div>
    </div>
    <div class="instruction-item">
      <div class="instruction-icon" style="color:var(--accent-amber);border-color:rgba(245,158,11,0.3);"><i class="fas fa-circle-info"></i></div>
      <div class="instruction-details">
        <div>Head towards ${routeDestinationSpot.name}</div>
        <div class="instruction-dist-time">Approx. ${estRoadDistanceKm} km • Straight-line estimate (OSRM routing service unavailable)</div>
      </div>
    </div>
    <div class="instruction-item">
      <div class="instruction-icon" style="color:#f43f5e;border-color:rgba(244,63,94,0.3);"><i class="fas fa-location-dot"></i></div>
      <div class="instruction-details">
        <div>Arrive at ${routeDestinationSpot.name}</div>
      </div>
    </div>
  `;
}

function drawRouteOnMap(geojsonGeometry, isFallback) {
  // Clear any existing route layers
  if (routePolyline) {
    map.removeLayer(routePolyline);
  }
  if (routeShadowPolyline) {
    map.removeLayer(routeShadowPolyline);
  }
  if (startMarker) {
    map.removeLayer(startMarker);
  }

  // GeoJSON [lng, lat] to Leaflet [lat, lng]
  const latlngs = geojsonGeometry.coordinates.map(c => [c[1], c[0]]);

  // Draw shadow/glow line
  routeShadowPolyline = L.polyline(latlngs, {
    color: '#0f172a',
    weight: 8,
    opacity: 0.55
  }).addTo(map);

  // Draw main line (orange if fallback, cyan/teal if OSRM)
  routePolyline = L.polyline(latlngs, {
    color: isFallback ? '#f97316' : '#14b8a6',
    weight: 4,
    opacity: 0.95,
    className: isFallback ? '' : 'route-line-animated'
  }).addTo(map);

  // Create Start Marker
  const startIcon = L.divIcon({
    html: `
      <div class="custom-marker">
        <div class="marker-pin" style="background: linear-gradient(135deg, #10b981, #047857); width:32px; height:32px; border-radius:50% 50% 50% 0; transform:rotate(-45deg);">
          <i class="fas fa-circle-dot" style="transform:rotate(45deg); font-size:11px; color:#fff; display:flex; align-items:center; justify-content:center;"></i>
        </div>
      </div>
    `,
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 38]
  });

  startMarker = L.marker(routeStartCoords, { icon: startIcon })
    .addTo(map)
    .bindPopup(`<b>Start Location:</b><br>${routeStartLabel}`)
    .openPopup();

  // Fit view to route bounds
  map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
}

function renderInstructions(steps) {
  const container = document.getElementById('routeInstructions');
  container.innerHTML = '';

  if (!steps || steps.length === 0) {
    container.innerHTML = '<div class="instructions-placeholder">No detailed road instructions available.</div>';
    return;
  }

  steps.forEach((step) => {
    const m = step.maneuver;
    let iconClass = 'fa-diamond-turn-right';

    if (m.type === 'depart') iconClass = 'fa-circle-play';
    else if (m.type === 'arrive') iconClass = 'fa-location-dot';
    else if (m.type === 'merge') iconClass = 'fa-code-merge';
    else if (m.type.includes('roundabout')) iconClass = 'fa-arrows-spin';
    else if (m.type === 'turn' || m.type === 'new name' || m.type === 'on ramp' || m.type === 'off ramp') {
      if (m.modifier && m.modifier.includes('left')) iconClass = 'fa-turn-left';
      else if (m.modifier && m.modifier.includes('right')) iconClass = 'fa-turn-right';
      else if (m.modifier && m.modifier.includes('straight')) iconClass = 'fa-arrow-up';
    } else if (m.modifier) {
      if (m.modifier.includes('left')) iconClass = 'fa-turn-left';
      else if (m.modifier.includes('right')) iconClass = 'fa-turn-right';
      else if (m.modifier.includes('straight')) iconClass = 'fa-arrow-up';
    }

    const item = document.createElement('div');
    item.className = 'instruction-item';

    // Step distance and time
    let stepDistStr = '';
    if (step.distance > 0) {
      if (step.distance >= 1000) {
        stepDistStr = `${(step.distance / 1000).toFixed(1)} km`;
      } else {
        stepDistStr = `${Math.round(step.distance)} m`;
      }
    }

    let stepTimeStr = '';
    if (step.duration > 0) {
      const s = Math.round(step.duration);
      if (s >= 60) {
        stepTimeStr = `${Math.round(s / 60)} min`;
      } else {
        stepTimeStr = `${s} s`;
      }
    }

    const stepMeta = (stepDistStr || stepTimeStr)
      ? `<div class="instruction-dist-time">${stepDistStr}${stepDistStr && stepTimeStr ? ' • ' : ''}${stepTimeStr}</div>`
      : '';

    // Instruction text from OSRM
    const instructionText = m.instruction || `${m.type} ${m.modifier || ''} onto ${step.name || 'road'}`;

    item.innerHTML = `
      <div class="instruction-icon" style="${m.type === 'arrive' ? 'color:#f43f5e; border-color:rgba(244,63,94,0.3);' : ''}">
        <i class="fas ${iconClass}"></i>
      </div>
      <div class="instruction-details">
        <div>${instructionText}</div>
        ${stepMeta}
      </div>
    `;
    container.appendChild(item);
  });
}

/* =============================================
   BOOT
   ============================================= */
document.addEventListener('DOMContentLoaded', initMap);
