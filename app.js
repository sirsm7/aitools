(function () {
  const CONFIG = window.APP_CONFIG;
  const IDBCache = window.IDBCache;

  let allData = [];
  let filteredData = [];
  let schoolListData = [];
  let currentViewMode = "teachers";
  let currentPage = 1;
  const pageSize = 30;

  const elSyncIndicator = document.getElementById("sync-indicator");
  const elBtnRefresh = document.getElementById("btn-refresh");

  const elCardConfirmed = document.getElementById("card-stat-confirmed");
  const elCardPending = document.getElementById("card-stat-pending");
  const elStatSchools = document.getElementById("stat-total-schools");
  const elStatEmails = document.getElementById("stat-total-emails");
  const elStatConfirmed = document.getElementById("stat-total-confirmed");
  const elStatPercent = document.getElementById("stat-percent-confirmed");
  const elStatPending = document.getElementById("stat-total-pending");

  const elFilterPpd = document.getElementById("filter-ppd");
  const elInputSearch = document.getElementById("input-search");
  const elSchoolList = document.getElementById("school-list");
  const elInputTeacherSearch = document.getElementById("input-teacher-search");
  const elFilterStatus = document.getElementById("filter-status");
  const elBtnReset = document.getElementById("btn-reset");

  const elSectionTable = document.getElementById("section-table");
  const elSearchPrompt = document.getElementById("search-prompt");
  const elTableHeadRow = document.getElementById("table-head-row");
  const elTableBody = document.getElementById("table-body");
  const elTableCountLabel = document.getElementById("table-count-label");
  const elBadgeViewMode = document.getElementById("badge-view-mode");
  const elCopyActionsGroup = document.getElementById("copy-actions-group");
  const elBtnCopyEmails = document.getElementById("btn-copy-emails");
  const elBtnCopyList = document.getElementById("btn-copy-list");
  const elTableSubLabel = document.getElementById("table-sub-label");
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

  async function writeToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  function updateSchoolDatalist() {
    if (!elSchoolList) return;
    while (elSchoolList.firstChild) {
      elSchoolList.removeChild(elSchoolList.firstChild);
    }

    const selectedPpd = elFilterPpd.value.trim().toLowerCase();
    const uniqueSchools = new Map();

    for (let i = 0; i < allData.length; i++) {
      const item = allData[i];
      if (selectedPpd && item.ppd.toLowerCase() !== selectedPpd) {
        continue;
      }
      if (item.nama_institusi && !uniqueSchools.has(item.nama_institusi)) {
        uniqueSchools.set(item.nama_institusi, item.kodsekolah || "");
      }
    }

    const sortedSchools = Array.from(uniqueSchools.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < sortedSchools.length; i++) {
      const [name, kod] = sortedSchools[i];
      const option = document.createElement("option");
      option.value = name;
      if (kod) {
        option.label = `${kod} - ${name}`;
      }
      fragment.appendChild(option);
    }

    elSchoolList.appendChild(fragment);
  }

  async function fetchData(forceRemote = false) {
    setSyncStatus("syncing", "Menyegerak data...");

    if (!forceRemote) {
      const cached = await IDBCache.get("teachers_data_cache");
      if (cached && cached.data && Array.isArray(cached.data)) {
        allData = cached.data;
        updateSchoolDatalist();
        updateScorecards();
        if (currentViewMode === "schools") {
          showConfirmedSchoolsView();
        } else {
          applyFilters();
        }
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
        updateSchoolDatalist();
        updateScorecards();
        if (currentViewMode === "schools") {
          showConfirmedSchoolsView();
        } else {
          applyFilters();
        }
        setSyncStatus("ready", "Terkini");
      } else {
        setSyncStatus("error", "Ralat format data");
        showToast("Gagal membaca struktur data pelayan", "error");
      }
    } catch (err) {
      const cached = await IDBCache.get("teachers_data_cache");
      if (cached && cached.data && Array.isArray(cached.data) && allData.length === 0) {
        allData = cached.data;
        updateSchoolDatalist();
        updateScorecards();
        if (currentViewMode === "schools") {
          showConfirmedSchoolsView();
        } else {
          applyFilters();
        }
        setSyncStatus("ready", "Data Tempatan");
      } else {
        setSyncStatus("error", "Luar Talian");
      }
      showToast("Gagal berhubung dengan pelayan Google Sheets", "error");
    }
  }

  function updateScorecards() {
    const selectedPpd = elFilterPpd.value.trim().toLowerCase();
    const uniqueSchools = new Set();
    let confirmedCount = 0;
    let totalRecords = 0;

    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];
      if (selectedPpd && row.ppd && row.ppd.toLowerCase() !== selectedPpd) {
        continue;
      }
      totalRecords++;
      if (row.kodsekolah) {
        uniqueSchools.add(row.kodsekolah);
      }
      if (row.status_pemakluman === true) {
        confirmedCount++;
      }
    }

    const pendingCount = totalRecords - confirmedCount;
    const percentConfirmed = totalRecords > 0 ? Math.round((confirmedCount / totalRecords) * 100) : 0;

    elStatSchools.textContent = uniqueSchools.size.toLocaleString("ms-MY");
    elStatEmails.textContent = totalRecords.toLocaleString("ms-MY");
    elStatConfirmed.textContent = confirmedCount.toLocaleString("ms-MY");
    elStatPercent.textContent = `${percentConfirmed}%`;
    elStatPending.textContent = pendingCount.toLocaleString("ms-MY");
  }

  function renderTableHeader() {
    if (!elTableHeadRow) return;
    while (elTableHeadRow.firstChild) {
      elTableHeadRow.removeChild(elTableHeadRow.firstChild);
    }

    const fragment = document.createDocumentFragment();

    if (currentViewMode === "schools") {
      const headers = [
        { label: "Bil", className: "py-3.5 px-4 w-16 text-center" },
        { label: "Kod Sekolah", className: "py-3.5 px-4 w-32" },
        { label: "Nama Sekolah / Institusi", className: "py-3.5 px-4" },
        { label: "PPD", className: "py-3.5 px-4 w-44" }
      ];

      for (let i = 0; i < headers.length; i++) {
        const th = document.createElement("th");
        th.setAttribute("scope", "col");
        th.className = headers[i].className;
        th.textContent = headers[i].label;
        fragment.appendChild(th);
      }
    } else {
      const headers = [
        { label: "Tindakan", className: "py-3.5 px-4 w-16 text-center" },
        { label: "Nama Guru", className: "py-3.5 px-4" },
        { label: "E-mel Delima", className: "py-3.5 px-4" },
        { label: "Kod Sekolah", className: "py-3.5 px-4" },
        { label: "Nama Sekolah / Institusi", className: "py-3.5 px-4" },
        { label: "PPD", className: "py-3.5 px-4" }
      ];

      for (let i = 0; i < headers.length; i++) {
        const th = document.createElement("th");
        th.setAttribute("scope", "col");
        th.className = headers[i].className;
        th.textContent = headers[i].label;
        fragment.appendChild(th);
      }
    }

    elTableHeadRow.appendChild(fragment);
  }

  function applyFilters() {
    currentViewMode = "teachers";
    renderTableHeader();

    if (elBadgeViewMode) {
      elBadgeViewMode.classList.add("hidden");
    }
    if (elTableSubLabel) {
      elTableSubLabel.textContent = "Tanda kotak untuk kemas kini langsung ke Google Sheets";
    }

    const selectedPpd = elFilterPpd.value.trim().toLowerCase();
    const querySearch = elInputSearch.value.trim().toLowerCase();
    const queryTeacher = elInputTeacherSearch.value.trim().toLowerCase();
    const selectedStatus = elFilterStatus.value;

    const hasSearchQuery = querySearch.length > 0 || queryTeacher.length > 0;
    const shouldDisplayTable = hasSearchQuery || selectedStatus.length > 0;

    if (elSectionTable && elSearchPrompt) {
      if (shouldDisplayTable) {
        elSectionTable.classList.remove("hidden");
        elSearchPrompt.classList.add("hidden");
      } else {
        elSectionTable.classList.add("hidden");
        elSearchPrompt.classList.remove("hidden");
      }
    }

    filteredData = allData.filter((item) => {
      if (selectedPpd && item.ppd && item.ppd.toLowerCase() !== selectedPpd) {
        return false;
      }

      if (querySearch) {
        const matchName = item.nama_institusi ? item.nama_institusi.toLowerCase().includes(querySearch) : false;
        const matchKod = item.kodsekolah ? item.kodsekolah.toLowerCase().includes(querySearch) : false;
        const matchCombined = `${item.kodsekolah || ""} - ${item.nama_institusi || ""}`.toLowerCase().includes(querySearch);
        if (!matchName && !matchKod && !matchCombined) {
          return false;
        }
      }

      if (queryTeacher) {
        const matchTeacherName = item.name ? item.name.toLowerCase().includes(queryTeacher) : false;
        const matchEmail = item.email ? item.email.toLowerCase().includes(queryTeacher) : false;
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

    if (elCopyActionsGroup) {
      if (shouldDisplayTable && filteredData.length > 0) {
        elCopyActionsGroup.classList.remove("hidden");
      } else {
        elCopyActionsGroup.classList.add("hidden");
      }
    }

    currentPage = 1;
    updateScorecards();
    renderTable();
  }

  function showConfirmedSchoolsView() {
    currentViewMode = "schools";
    renderTableHeader();

    if (elBadgeViewMode) {
      elBadgeViewMode.classList.remove("hidden");
      elBadgeViewMode.textContent = "Senarai Sekolah Terlibat";
    }
    if (elTableSubLabel) {
      elTableSubLabel.textContent = "Senarai institusi yang telah selesai dimaklumkan";
    }
    if (elCopyActionsGroup) {
      elCopyActionsGroup.classList.add("hidden");
    }

    if (elSectionTable && elSearchPrompt) {
      elSectionTable.classList.remove("hidden");
      elSearchPrompt.classList.add("hidden");
    }

    const selectedPpd = elFilterPpd.value.trim().toLowerCase();
    const querySearch = elInputSearch.value.trim().toLowerCase();
    const uniqueConfirmedSchools = new Map();

    for (let i = 0; i < allData.length; i++) {
      const item = allData[i];
      if (item.status_pemakluman !== true) continue;
      if (selectedPpd && item.ppd && item.ppd.toLowerCase() !== selectedPpd) continue;

      if (querySearch) {
        const matchName = item.nama_institusi ? item.nama_institusi.toLowerCase().includes(querySearch) : false;
        const matchKod = item.kodsekolah ? item.kodsekolah.toLowerCase().includes(querySearch) : false;
        const matchCombined = `${item.kodsekolah || ""} - ${item.nama_institusi || ""}`.toLowerCase().includes(querySearch);
        if (!matchName && !matchKod && !matchCombined) continue;
      }

      const key = (item.kodsekolah || item.nama_institusi || "").trim().toUpperCase();
      if (key && !uniqueConfirmedSchools.has(key)) {
        uniqueConfirmedSchools.set(key, {
          kodsekolah: item.kodsekolah ? item.kodsekolah.trim() : "-",
          nama_institusi: item.nama_institusi ? item.nama_institusi.trim() : "-",
          ppd: item.ppd ? item.ppd.trim() : "-"
        });
      }
    }

    schoolListData = Array.from(uniqueConfirmedSchools.values()).sort((a, b) => {
      const cmpPpd = a.ppd.localeCompare(b.ppd);
      if (cmpPpd !== 0) return cmpPpd;
      return a.nama_institusi.localeCompare(b.nama_institusi);
    });

    currentPage = 1;
    updateScorecards();
    renderSchoolsTable();

    if (elSectionTable) {
      elSectionTable.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

  function renderSchoolsTable() {
    while (elTableBody.firstChild) {
      elTableBody.removeChild(elTableBody.firstChild);
    }

    const totalRecords = schoolListData.length;
    elTableCountLabel.textContent = `Menjumpai ${totalRecords.toLocaleString("ms-MY")} sekolah`;

    if (totalRecords === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.setAttribute("colspan", "4");
      emptyCell.className = "py-12 text-center text-slate-400 text-sm";
      emptyCell.textContent = "Tiada padanan sekolah dijumpai.";
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
    const pageRecords = schoolListData.slice(startIndex, endIndex);

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < pageRecords.length; i++) {
      const item = pageRecords[i];
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100";

      const tdIndex = document.createElement("td");
      tdIndex.className = "py-3.5 px-4 text-center font-medium text-slate-500 text-xs";
      tdIndex.textContent = String(startIndex + i + 1);

      const tdKod = document.createElement("td");
      tdKod.className = "py-3.5 px-4";
      const badgeKod = document.createElement("span");
      badgeKod.className = "px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200";
      badgeKod.textContent = item.kodsekolah;
      tdKod.appendChild(badgeKod);

      const tdInstitusi = document.createElement("td");
      tdInstitusi.className = "py-3.5 px-4 text-slate-800 text-xs sm:text-sm font-medium";
      tdInstitusi.textContent = item.nama_institusi;

      const tdPpd = document.createElement("td");
      tdPpd.className = "py-3.5 px-4";
      const badgePpd = document.createElement("span");
      badgePpd.className = "px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100";
      badgePpd.textContent = item.ppd;
      tdPpd.appendChild(badgePpd);

      tr.appendChild(tdIndex);
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
    const unitLabel = currentViewMode === "schools" ? "sekolah" : "rekod";

    elPaginationInfo.textContent = `Memaparkan ${startItem} - ${endItem} daripada ${totalRecords.toLocaleString("ms-MY")} ${unitLabel}`;
    elPageIndicator.textContent = `${currentPage} / ${totalPages}`;

    elBtnPrev.disabled = currentPage <= 1;
    elBtnNext.disabled = currentPage >= totalPages;
  }

  async function copyFilteredEmails() {
    if (!filteredData || filteredData.length === 0) {
      showToast("Tiada data guru dalam senarai carian.", "info");
      return;
    }

    const emails = [];
    const seen = new Set();

    for (let i = 0; i < filteredData.length; i++) {
      const em = filteredData[i].email ? filteredData[i].email.trim() : "";
      if (em && !seen.has(em.toLowerCase())) {
        seen.add(em.toLowerCase());
        emails.push(em);
      }
    }

    if (emails.length === 0) {
      showToast("Tiada alamat e-mel yang sah ditemui.", "info");
      return;
    }

    const message = emails.join(", ");

    try {
      await writeToClipboard(message);
      showToast(`${emails.length} alamat e-mel berjaya disalin.`, "success");
    } catch (err) {
      showToast("Gagal menyalin senarai e-mel ke papan keratan.", "error");
    }
  }

  async function copyFilteredTeachersList() {
    if (!filteredData || filteredData.length === 0) {
      showToast("Tiada data guru dalam senarai carian.", "info");
      return;
    }

    const headerText = "SENARAI GURU CARIAN AI-TOOLS";
    const bodyLines = filteredData.map((item, idx) => {
      const teacherName = item.name ? item.name.trim() : "TIADA NAMA";
      const teacherEmail = item.email ? ` <${item.email.trim()}>` : "";
      const schoolName = item.nama_institusi ? ` - ${item.nama_institusi.trim()}` : "";
      return `${idx + 1}. ${teacherName}${teacherEmail}${schoolName}`;
    });

    const fullMessage = `${headerText}\nJumlah: ${filteredData.length} orang\n\n${bodyLines.join("\n")}`;

    try {
      await writeToClipboard(fullMessage);
      showToast(`Senarai ${filteredData.length} rekod guru berjaya disalin.`, "success");
    } catch (err) {
      showToast("Gagal menyalin senarai nama dan e-mel guru ke papan keratan.", "error");
    }
  }

  function isSecondarySchool(code, name) {
    const c = (code || "").toUpperCase().trim();
    const n = (name || "").toUpperCase().trim();

    if (c.length >= 2) {
      const secondChar = c.charAt(1);
      if (secondChar === "E" || secondChar === "F") return true;
      if (secondChar === "B" || secondChar === "C") return false;
    }

    if (
      n.startsWith("SMK") ||
      n.startsWith("SMA") ||
      n.startsWith("SM ") ||
      n.startsWith("SMJK") ||
      n.includes("SEKOLAH MENENGAH") ||
      n.includes("KOLEJ") ||
      n.includes("IMTIAZ") ||
      n.includes("VOKASIONAL") ||
      n.includes("TEKNIK")
    ) {
      return true;
    }

    return false;
  }

  async function copyPendingSchoolsList() {
    const selectedPpd = elFilterPpd.value.trim().toLowerCase();
    const uniquePendingSchools = new Map();

    for (let i = 0; i < allData.length; i++) {
      const item = allData[i];
      if (item.status_pemakluman === true) continue;
      if (selectedPpd && item.ppd && item.ppd.toLowerCase() !== selectedPpd) continue;

      const key = (item.kodsekolah || item.nama_institusi || "").trim().toUpperCase();
      if (key && !uniquePendingSchools.has(key)) {
        uniquePendingSchools.set(key, {
          kodsekolah: item.kodsekolah ? item.kodsekolah.trim() : "",
          nama_institusi: item.nama_institusi ? item.nama_institusi.trim() : "",
          ppd: item.ppd ? item.ppd.trim() : "",
          order: i
        });
      }
    }

    const pendingList = Array.from(uniquePendingSchools.values());

    if (pendingList.length === 0) {
      showToast("Tiada sekolah yang belum selesai pemakluman.", "info");
      return;
    }

    if (!selectedPpd) {
      pendingList.sort((a, b) => {
        const cmpPpd = a.ppd.localeCompare(b.ppd);
        if (cmpPpd !== 0) return cmpPpd;
        return a.order - b.order;
      });
    } else {
      pendingList.sort((a, b) => a.order - b.order);
    }

    const primaryList = [];
    const secondaryList = [];

    for (let i = 0; i < pendingList.length; i++) {
      const sch = pendingList[i];
      if (isSecondarySchool(sch.kodsekolah, sch.nama_institusi)) {
        secondaryList.push(sch);
      } else {
        primaryList.push(sch);
      }
    }

    let authorityLabel = "JPN MELAKA";
    const rawSelectedPpd = elFilterPpd.value.trim();
    if (rawSelectedPpd) {
      authorityLabel = rawSelectedPpd.toUpperCase();
    } else {
      const ppdSet = new Set();
      for (let i = 0; i < pendingList.length; i++) {
        if (pendingList[i].ppd) {
          ppdSet.add(pendingList[i].ppd.trim().toUpperCase());
        }
      }
      if (ppdSet.size === 1) {
        authorityLabel = Array.from(ppdSet)[0];
      } else {
        authorityLabel = "JPN MELAKA";
      }
    }

    const lines = [];
    lines.push("📋 SENARAI SEKOLAH BELUM SELESAI PEMAKLUMAN SEMAKAN AI TOOLS");
    lines.push(`📌 JUMLAH KESELURUHAN: ${pendingList.length} BUAH SEKOLAH`);

    if (primaryList.length > 0) {
      lines.push("━━━━━━━━━━━━━━━━━━");
      lines.push(`1. 🏫 SEKOLAH RENDAH: ${primaryList.length} buah sekolah`);
      lines.push("━━━━━━━━━━━━━━━━━━");
      for (let i = 0; i < primaryList.length; i++) {
        const sch = primaryList[i];
        const kod = sch.kodsekolah ? sch.kodsekolah : "-";
        lines.push(`${kod} – ${sch.nama_institusi}`);
      }
    }

    if (secondaryList.length > 0) {
      lines.push("━━━━━━━━━━━━━━━━━━");
      lines.push(`🏢 2. SEKOLAH MENENGAH: ${secondaryList.length} buah sekolah`);
      lines.push("━━━━━━━━━━━━━━━━━━");
      for (let i = 0; i < secondaryList.length; i++) {
        const sch = secondaryList[i];
        const kod = sch.kodsekolah ? sch.kodsekolah : "-";
        lines.push(`${kod} – ${sch.nama_institusi}`);
      }
    }

    lines.push("━━━━━━━━━━━━━━━━━━");
    lines.push("Terima kasih atas kerjasama semua.");
    lines.push(authorityLabel);

    const fullMessage = lines.join("\n");

    try {
      await writeToClipboard(fullMessage);
      showToast(`Senarai ${pendingList.length} sekolah belum selesai berjaya disalin.`, "success");
    } catch (err) {
      showToast("Gagal menyalin senarai sekolah ke papan keratan.", "error");
    }
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

  function handleAutoCapsInput(event) {
    const target = event.target;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    target.value = target.value.toUpperCase();
    target.setSelectionRange(start, end);
  }

  if (elCardConfirmed) {
    elCardConfirmed.addEventListener("click", showConfirmedSchoolsView);
    elCardConfirmed.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showConfirmedSchoolsView();
      }
    });
  }

  if (elCardPending) {
    elCardPending.addEventListener("click", copyPendingSchoolsList);
    elCardPending.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        copyPendingSchoolsList();
      }
    });
  }

  if (elBtnCopyEmails) {
    elBtnCopyEmails.addEventListener("click", copyFilteredEmails);
  }

  if (elBtnCopyList) {
    elBtnCopyList.addEventListener("click", copyFilteredTeachersList);
  }

  elFilterPpd.addEventListener("change", () => {
    updateSchoolDatalist();
    if (currentViewMode === "schools") {
      showConfirmedSchoolsView();
    } else {
      applyFilters();
    }
  });

  elFilterStatus.addEventListener("change", () => {
    if (elFilterStatus.value === "done") {
      showConfirmedSchoolsView();
    } else {
      currentViewMode = "teachers";
      applyFilters();
    }
  });

  let searchTimeout = null;
  function handleSearchDebounce() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (currentViewMode === "schools") {
        showConfirmedSchoolsView();
      } else {
        applyFilters();
      }
    }, 150);
  }

  elInputSearch.addEventListener("input", (event) => {
    handleAutoCapsInput(event);
    handleSearchDebounce();
  });

  elInputTeacherSearch.addEventListener("input", (event) => {
    handleAutoCapsInput(event);
    if (currentViewMode === "schools") {
      currentViewMode = "teachers";
    }
    handleSearchDebounce();
  });

  if (elBtnReset) {
    elBtnReset.addEventListener("click", () => {
      elFilterPpd.value = "";
      elInputSearch.value = "";
      elInputTeacherSearch.value = "";
      elFilterStatus.value = "";
      currentViewMode = "teachers";
      if (elBadgeViewMode) {
        elBadgeViewMode.classList.add("hidden");
      }
      if (elCopyActionsGroup) {
        elCopyActionsGroup.classList.add("hidden");
      }
      if (elTableSubLabel) {
        elTableSubLabel.textContent = "Tanda kotak untuk kemas kini langsung ke Google Sheets";
      }
      renderTableHeader();
      updateSchoolDatalist();
      applyFilters();
    });
  }

  elBtnPrev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      if (currentViewMode === "schools") {
        renderSchoolsTable();
      } else {
        renderTable();
      }
    }
  });

  elBtnNext.addEventListener("click", () => {
    const list = currentViewMode === "schools" ? schoolListData : filteredData;
    const totalPages = Math.ceil(list.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      if (currentViewMode === "schools") {
        renderSchoolsTable();
      } else {
        renderTable();
      }
    }
  });

  elBtnRefresh.addEventListener("click", () => {
    fetchData(true);
  });

  const SESSION_KEY = "dashboard_session_active";
  let isSessionActive = false;

  try {
    isSessionActive = Boolean(sessionStorage.getItem(SESSION_KEY));
    if (!isSessionActive) {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  } catch (err) {
    isSessionActive = false;
  }

  fetchData(!isSessionActive);
})();