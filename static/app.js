// --- Login Status (Course Page) ---

async function fetchLoginStatus(courseName) {
    try {
        const resp = await fetch(`/api/courses/${courseName}`);
        const data = await resp.json();

        for (const student of data.students) {
            const cells = document.querySelectorAll(
                `.login-status[data-student-id="${student.student_id}"]`
            );
            for (const cell of cells) {
                const ls = student.login_status;
                if (!ls || !ls.exists) {
                    cell.innerHTML = '<span class="badge badge-notfound">Not found</span>';
                } else if (ls.logged_in) {
                    const date = new Date(ls.last_login).toLocaleDateString();
                    cell.innerHTML = `<span class="badge badge-ok">Logged in</span> ${date}`;
                } else {
                    cell.innerHTML = '<span class="badge badge-never">Never</span>';
                }
            }
        }
    } catch (err) {
        console.error('Failed to fetch login status:', err);
        document.querySelectorAll('.login-status').forEach(cell => {
            cell.innerHTML = '<span class="badge badge-error">Error</span>';
        });
    }
}

// --- API Helpers ---

async function apiCall(url, method = 'GET', body = null) {
    const options = { method, headers: {} };
    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const resp = await fetch(url, options);
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert(err.error || `Request failed (${resp.status})`);
        throw new Error(err.error || resp.statusText);
    }
    return resp.json();
}

// --- Team Management Actions ---

async function assignTeam(courseName, line, teamName) {
    await apiCall(`/api/courses/${courseName}/students/${line}`, 'PUT',
                  { team_name: teamName });
    location.reload();
}

async function removeFromTeam(courseName, line) {
    await apiCall(`/api/courses/${courseName}/students/${line}/team`, 'DELETE');
    location.reload();
}

async function toggleStudent(courseName, line) {
    await apiCall(`/api/courses/${courseName}/students/${line}/toggle`, 'PATCH');
    location.reload();
}

async function addStudent(courseName, studentId, studentName, teamName) {
    await apiCall(`/api/courses/${courseName}/students`, 'POST', {
        student_id: studentId,
        student_name: studentName,
        team_name: teamName || null,
    });
    location.reload();
}

// --- UI Helpers ---

function createTeam() {
    const input = document.getElementById('new-team-name');
    const name = input.value.trim();
    if (!name) return;

    // Add the new team to all team-select dropdowns on the page
    document.querySelectorAll('.team-select, select[name="team_name"]').forEach(select => {
        // Avoid duplicates
        for (const opt of select.options) {
            if (opt.value === name) return;
        }
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    // Add chip to the team list
    const chipList = document.getElementById('team-chip-list');
    if (chipList) {
        const chip = document.createElement('span');
        chip.className = 'team-chip team-chip--new active';
        chip.dataset.team = name;
        chip.textContent = name;
        chip.onclick = function() { toggleTeamChip(this); };
        chipList.appendChild(chip);
    }

    // Create empty team article above existing teams
    const hr = document.querySelector('main.container hr');
    if (hr) {
        const article = document.createElement('article');
        article.dataset.team = name;
        article.className = 'new-team-article';
        article.innerHTML =
            '<header><strong>' + name + '</strong>' +
            '<span class="team-header-count">0 students</span></header>' +
            '<div class="overflow-auto"><table><thead><tr>' +
            '<th>Student ID</th><th>Name</th><th>Actions</th>' +
            '</tr></thead><tbody></tbody></table></div>';
        hr.insertAdjacentElement('afterend', article);
    }

    input.value = '';
}

function assignTeamFromSelect(courseName, line) {
    const select = document.querySelector(`select.team-select[data-line="${line}"]`);
    if (!select || !select.value) {
        alert('Please select a team first.');
        return;
    }
    assignTeam(courseName, line, select.value);
}

function toggleTeamChip(chip) {
    chip.classList.toggle('active');
    const teamName = chip.dataset.team;
    const article = document.querySelector(`article[data-team="${teamName}"]`);
    if (article) {
        article.style.display = chip.classList.contains('active') ? '' : 'none';
    }
}

function filterUnassigned() {
    const query = document.getElementById('unassigned-filter').value.toLowerCase();
    const rows = document.querySelectorAll('#unassigned-table tbody tr');
    for (const row of rows) {
        const id = row.cells[0].textContent.toLowerCase();
        const name = row.cells[1].textContent.toLowerCase();
        row.style.display = (id.includes(query) || name.includes(query)) ? '' : 'none';
    }
}
