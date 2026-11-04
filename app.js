(function () {
  const CONFIG = window.APP_CONFIG;
  const IDBCache = window.IDBCache;

  let allData = [];
  let filteredData = [];
  let currentPage = 1;
  const pageSize = 30;

  const elSyncIndicator = document.getElementById("sync-indicator");
  const elBtnRefresh = document.getElementById("btn-refresh");

  const elStatSchools = document.getElementById("stat-total-schools");
  const elStatEmails = document.getElementById("stat-total-emails");
  const elStatConfirmed = document.getElementById("stat-total-confirmed");
  const elStatPercent = document.getElementById("stat-percent-confirmed");
  const elStatPending = document.getElementById("stat-total-pending");

  const elFilterPpd = document.getElementById("filter-ppd");
  const elInputSearch = document.getElementById("input-search");
  const elInputTeacherSearch = document.getElementById("input-teacher-search");
  const elFilterStatus = document.getElementById("filter-status");

  const elSectionTable = document.getElementById("section-table");
  const elSearchPrompt = document.getElementById("search-prompt");
  const elTableBody = document.getElementById("table-body");
  const elTableCountLabel = document.getElementById("table-count-label");
  const elPaginationInfo = document.getElementById("pagination-info");
  const elBtnPrev = document.getElementById("btn-prev");
  const elBtnNext = document.getElementById("btn-next");
  const elPageIndicator = document.getElementById("page-indicator");
  const elToastContainer = document.getElementById("toast-container");

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = "pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-xs font-semibold text-white transition-opacity duration-300";
    if (type === "success") {
      toast.classList.add("bg-emerald-600");
    } else if (type === "error") {
      toast.classList.add("bg-rose-600");
    } else {
      toast.classList.add("bg-slate-700");
    }
    toast.textContent = message;

    elToastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  function setSyncStatus(state, label) {
    while (elSyncIndicator.firstChild) {
      elSyncIndicator.removeChild(elSyncIndicator.firstChild);
    }
    const dot = document.createElement("span");
    dot.className = "w-2 h-2 rounded-full";

    if (state === "syncing") {
      dot.classList.add("bg-amber-400", "animate-ping");
      elSyncIndicator.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200";
    } else if (state === "ready") {
      dot.classList.add("bg-emerald-500");
      elSyncIndicator.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200";
    } else {
      dot.classList.add("bg-rose-500");
      elSyncIndicator.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200";
    }

    elSyncIndicator.appendChild(dot);
    const textNode = document.createTextNode(label);
    elSyncIndicator.appendChild(textNode);
  }

  async function fetchData(forceRemote = false) {
    setSyncStatus("syncing", "Menyegerak data...");

    if (!forceRemote) {
      const cached = await IDBCache.get("teachers_data_cache");
      if (cached && cached.data && Array.isArray(cached.data)) {
        allData = cached.data;
        applyFilters();
        setSyncStatus("ready", "Data Tempatan");
        if (cached.isStale) {
          fetchFromNetwork();
        }
        return;
      }
    }

    await fetchFromNetwork();
  }

  async function fetchFromNetwork() {
    try {
      const response = await fetch(CONFIG.GAS_ENDPOINT_URL, {
        method: "GET",
        headers: {
          "Content-Type": "text/plain"
        }
      });

      const rawText = await response.text();
      const result = JSON.parse(rawText);

      if (result.status === "success" && Array.isArray(result.data)) {
        allData = result.data;
        await IDBCache.set("teachers_data_cache", allData);
        applyFilters();
        setSyncStatus("ready", "Terkini");
      } else {
        setSyncStatus("error", "Ralat format data");
        showToast("Gagal membaca struktur data pelayan", "error");
      }
    } catch (err) {
      setSyncStatus("error", "Luar Talian");
      showToast("Gagal berhubung dengan pelayan Google Sheets", "error");
    }
  }

  function applyFilters() {
    const selectedPpd = elFilterPpd.value.trim().toLowerCase();
    const querySearch = elInputSearch.value.trim().toLowerCase();
    const queryTeacher = elInputTeacherSearch.value.trim().toLowerCase();
    const selectedStatus = elFilterStatus.value;

    const hasSearchQuery = querySearch.length > 0 || queryTeacher.length > 0;

    if (elSectionTable && elSearchPrompt) {
      if (hasSearchQuery) {
        elSectionTable.classList.remove("hidden");
        elSearchPrompt.classList.add("hidden");
      } else {
        elSectionTable.classList.add("hidden");
        elSearchPrompt.classList.remove("hidden");
      }
    }

    filteredData = allData.filter((item) => {
      if (selectedPpd && item.ppd.toLowerCase() !== selectedPpd) {
        return false;
      }

      if (querySearch) {
        const matchName = item.nama_institusi.toLowerCase().includes(querySearch);
        const matchKod = item.kodsekolah.toLowerCase().includes(querySearch);
        if (!matchName && !matchKod) {
          return false;
        }
      }

      if (queryTeacher) {
        const matchTeacherName = item.name.toLowerCase().includes(queryTeacher);
        const matchEmail = item.email.toLowerCase().includes(queryTeacher);
        if (!matchTeacherName && !matchEmail) {
          return false;
        }
      }

      if (selectedStatus === "done" && !item.status_pemakluman) {
        return false;
      }
      if (selectedStatus === "pending" && item.status_pemakluman) {
        return false;
      }

      return true;
    });

    currentPage = 1;
    updateScorecards();
    renderTable();
  }

  function updateScorecards() {
    const uniqueSchools = new Set();
    let confirmedCount = 0;

    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      if (row.kodsekolah) {
        uniqueSchools.add(row.kodsekolah);
      }
      if (row.status_pemakluman === true) {
        confirmedCount++;
      }
    }

    const totalRecords = filteredData.length;
    const pendingCount = totalRecords - confirmedCount;
    const percentConfirmed = totalRecords > 0 ? Math.round((confirmedCount / totalRecords) * 100) : 0;

    elStatSchools.textContent = uniqueSchools.size.toLocaleString("ms-MY");
    elStatEmails.textContent = totalRecords.toLocaleString("ms-MY");
    elStatConfirmed.textContent = confirmedCount.toLocaleString("ms-MY");
    elStatPercent.textContent = `${percentConfirmed}%`;
    elStatPending.textContent = pendingCount.toLocaleString("ms-MY");
  }

  function renderTable() {
    while (elTableBody.firstChild) {
      elTableBody.removeChild(elTableBody.firstChild);
    }

    const totalRecords = filteredData.length;
    elTableCountLabel.textContent = `Menjumpai ${totalRecords.toLocaleString("ms-MY")} rekod`;

    if (totalRecords === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.setAttribute("colspan", "6");
      emptyCell.className = "py-12 text-center text-slate-400 text-sm";
      emptyCell.textContent = "Tiada padanan data dijumpai.";
      emptyRow.appendChild(emptyCell);
      elTableBody.appendChild(emptyRow);
      renderPagination(0);
      return;
    }

    const totalPages = Math.ceil(totalRecords / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const pageRecords = filteredData.slice(startIndex, endIndex);

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < pageRecords.length; i++) {
      const item = pageRecords[i];
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100";

      const tdAction = document.createElement("td");
      tdAction.className = "py-3.5 px-4 text-center";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer";
      checkbox.checked = Boolean(item.status_pemakluman);
      checkbox.setAttribute("data-email", item.email);
      checkbox.addEventListener("change", handleStatusChange);
      tdAction.appendChild(checkbox);

      const tdName = document.createElement("td");
      tdName.className = "py-3.5 px-4 font-medium text-slate-900";
      tdName.textContent = item.name;

      const tdEmail = document.createElement("td");
      tdEmail.className = "py-3.5 px-4 text-slate-600 font-mono text-xs";
      tdEmail.textContent = item.email;

      const tdKod = document.createElement("td");
      tdKod.className = "py-3.5 px-4";
      const badgeKod = document.createElement("span");
      badgeKod.className = "px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200";
      badgeKod.textContent = item.kodsekolah;
      tdKod.appendChild(badgeKod);

      const tdInstitusi = document.createElement("td");
      tdInstitusi.className = "py-3.5 px-4 text-slate-800 text-xs sm:text-sm";
      tdInstitusi.textContent = item.nama_institusi;

      const tdPpd = document.createElement("td");
      tdPpd.className = "py-3.5 px-4";
      const badgePpd = document.createElement("span");
      badgePpd.className = "px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100";
      badgePpd.textContent = item.ppd;
      tdPpd.appendChild(badgePpd);

      tr.appendChild(tdAction);
      tr.appendChild(tdName);
      tr.appendChild(tdEmail);
      tr.appendChild(tdKod);
      tr.appendChild(tdInstitusi);
      tr.appendChild(tdPpd);

      fragment.appendChild(tr);
    }

    elTableBody.appendChild(fragment);
    renderPagination(totalRecords);
  }

  function renderPagination(totalRecords) {
    if (totalRecords === 0) {
      elPaginationInfo.textContent = "Tiada rekod";
      elBtnPrev.disabled = true;
      elBtnNext.disabled = true;
      elPageIndicator.textContent = "0";
      return;
    }

    const totalPages = Math.ceil(totalRecords / pageSize);
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalRecords);

    elPaginationInfo.textContent = `Memaparkan ${startItem} - ${endItem} daripada ${totalRecords.toLocaleString("ms-MY")} rekod`;
    elPageIndicator.textContent = `${currentPage} / ${totalPages}`;

    elBtnPrev.disabled = currentPage <= 1;
    elBtnNext.disabled = currentPage >= totalPages;
  }

  async function handleStatusChange(event) {
    const checkbox = event.target;
    const targetEmail = checkbox.getAttribute("data-email");
    const nextStatus = checkbox.checked;

    const recordIndex = allData.findIndex((r) => r.email === targetEmail);
    if (recordIndex === -1) return;

    allData[recordIndex].status_pemakluman = nextStatus;
    updateScorecards();
    await IDBCache.set("teachers_data_cache", allData);

    checkbox.disabled = true;

    try {
      const response = await fetch(CONFIG.GAS_ENDPOINT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify({
          email: targetEmail,
          status: nextStatus
        })
      });

      const rawText = await response.text();
      const result = JSON.parse(rawText);

      if (result.status === "success") {
        showToast(`Status pemakluman ${targetEmail} berjaya dikemas kini.`, "success");
      } else {
        throw new Error(result.message || "Ralat kemaskini");
      }
    } catch (err) {
      allData[recordIndex].status_pemakluman = !nextStatus;
      checkbox.checked = !nextStatus;
      updateScorecards();
      await IDBCache.set("teachers_data_cache", allData);
      showToast(`Gagal mengemas kini ${targetEmail}. Tindakan dikembalikan.`, "error");
    } finally {
      checkbox.disabled = false;
    }
  }

  elFilterPpd.addEventListener("change", applyFilters);
  elFilterStatus.addEventListener("change", applyFilters);

  let searchTimeout = null;
  function handleSearchDebounce() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 150);
  }

  elInputSearch.addEventListener("input", handleSearchDebounce);
  elInputTeacherSearch.addEventListener("input", handleSearchDebounce);

  elBtnPrev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  elBtnNext.addEventListener("click", () => {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  elBtnRefresh.addEventListener("click", () => {
    fetchData(true);
  });

  fetchData(false);
})();