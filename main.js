const TICKET_PRICE = 300;
const WEEKLY_TICKETS = 10;
const BASE_TICKETS_PER_SECOND = 10;
const MAX_HISTORY_ITEMS = 80;
const GROUP_COUNT = 200;
const NUMBERS_PER_GROUP = 100_000;
const UNIT_SIZE = GROUP_COUNT * NUMBERS_PER_GROUP;
const FIRST_NUMBER_OFFSET = 100_000;

const prizeTable = [
  { rank: "1等", oddsLabel: "1 / 20,000,000", prize: 700_000_000 },
  { rank: "1等の前後賞", oddsLabel: "1 / 10,000,000", prize: 150_000_000 },
  { rank: "1等の組違い賞", oddsLabel: "約1 / 100,503", prize: 100_000 },
  { rank: "2等", oddsLabel: "1 / 20,000,000", prize: 100_000_000 },
  { rank: "3等", oddsLabel: "1 / 5,000,000", prize: 10_000_000 },
  { rank: "4等", oddsLabel: "1 / 500,000", prize: 1_000_000 },
  { rank: "5等", oddsLabel: "約1 / 333", prize: 10_000 },
  { rank: "6等", oddsLabel: "1 / 100", prize: 3_000 },
  { rank: "7等", oddsLabel: "1 / 10", prize: 300 },
];

const prizeByRank = Object.fromEntries(
  prizeTable.map((prize) => [prize.rank, prize])
);

const elements = {
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  resetButton: document.querySelector("#resetButton"),
  speedSelect: document.querySelector("#speedSelect"),
  ticketsCount: document.querySelector("#ticketsCount"),
  spentAmount: document.querySelector("#spentAmount"),
  returnedAmount: document.querySelector("#returnedAmount"),
  profitLoss: document.querySelector("#profitLoss"),
  returnRate: document.querySelector("#returnRate"),
  elapsedTime: document.querySelector("#elapsedTime"),
  currentTicket: document.querySelector("#currentTicket"),
  ticketSetProgress: document.querySelector("#ticketSetProgress"),
  realWorldTime: document.querySelector("#realWorldTime"),
  firstPrizeStatus: document.querySelector("#firstPrizeStatus"),
  winHistory: document.querySelector("#winHistory"),
  historyCount: document.querySelector("#historyCount"),
  winSummary: document.querySelector("#winSummary"),
  prizeTable: document.querySelector("#prizeTable"),
  quietMessage: document.querySelector("#quietMessage"),
};

const state = {
  running: false,
  tickets: 0,
  returned: 0,
  elapsedMs: 0,
  lastFrameAt: 0,
  ticketCarry: 0,
  history: [],
  winSummary: createEmptySummary(),
  ticketSet: createUnit(),
  currentTicket: null,
  firstPrize: null,
  lastQuietMark: 0,
};

const yenFormatter = new Intl.NumberFormat("ja-JP");
const integerFormatter = new Intl.NumberFormat("ja-JP");
const yearsFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 0,
});

function formatYen(value) {
  return `${yenFormatter.format(value)}円`;
}

function formatTickets(value) {
  return `${integerFormatter.format(value)}枚`;
}

function formatTicketLabel(ticket) {
  return `${ticket.group}組 ${ticket.number}番`;
}

function getTicketMarkup(ticket) {
  return `
    <span class="ticket-label">
      <span class="ticket-group">
        <span class="ticket-group-number">${ticket.group}</span>
        <span class="ticket-group-unit">組</span>
      </span>
      <span class="ticket-number">${ticket.number}番</span>
    </span>
  `;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function getRealWorldYears(tickets) {
  return tickets / WEEKLY_TICKETS / 52;
}

function getSelectedSpeedMode() {
  const multiplier = Number(elements.speedSelect.value);
  const label =
    elements.speedSelect.options[elements.speedSelect.selectedIndex].textContent;

  return {
    label,
    ticketsPerSecond: BASE_TICKETS_PER_SECOND * multiplier,
  };
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function createTraversalStep() {
  let step = 1;

  do {
    step = randomInt(UNIT_SIZE - 1) + 1;
  } while (step % 2 === 0 || step % 5 === 0);

  return step;
}

function createTicketFromId(id) {
  const group = Math.floor(id / NUMBERS_PER_GROUP) + 1;
  const numberIndex = id % NUMBERS_PER_GROUP;

  return {
    id,
    group,
    numberIndex,
    number: FIRST_NUMBER_OFFSET + numberIndex,
  };
}

function createWinningEndings() {
  const seventhEnding = randomInt(10);
  let sixthEnding = randomInt(100);
  const fifthEndings = new Set();

  while (sixthEnding % 10 === seventhEnding) {
    sixthEnding = randomInt(100);
  }

  while (fifthEndings.size < 3) {
    const ending = randomInt(1000);

    if (ending % 100 !== sixthEnding && ending % 10 !== seventhEnding) {
      fifthEndings.add(ending);
    }
  }

  return {
    fifthEndings,
    sixthEnding,
    seventhEnding,
  };
}

function matchesLowPrizeEnding(numberIndex, endings) {
  return (
    endings.fifthEndings.has(numberIndex % 1000) ||
    numberIndex % 100 === endings.sixthEnding ||
    numberIndex % 10 === endings.seventhEnding
  );
}

function createPrizeIdSet(size, usedIds, endings, firstNumberIndex) {
  const ids = new Set();

  while (ids.size < size) {
    const id = randomInt(UNIT_SIZE);
    const numberIndex = id % NUMBERS_PER_GROUP;

    if (
      usedIds.has(id) ||
      numberIndex === firstNumberIndex ||
      matchesLowPrizeEnding(numberIndex, endings)
    ) {
      continue;
    }

    ids.add(id);
    usedIds.add(id);
  }

  return ids;
}

function createUnit() {
  const endings = createWinningEndings();
  const firstGroup = randomInt(GROUP_COUNT) + 1;
  let firstNumberIndex = randomInt(NUMBERS_PER_GROUP - 2) + 1;

  while (
    matchesLowPrizeEnding(firstNumberIndex - 1, endings) ||
    matchesLowPrizeEnding(firstNumberIndex, endings) ||
    matchesLowPrizeEnding(firstNumberIndex + 1, endings)
  ) {
    firstNumberIndex = randomInt(NUMBERS_PER_GROUP - 2) + 1;
  }

  const firstPrizeId = (firstGroup - 1) * NUMBERS_PER_GROUP + firstNumberIndex;
  const frontPrizeId = firstPrizeId - 1;
  const backPrizeId = firstPrizeId + 1;
  const usedIds = new Set([firstPrizeId, frontPrizeId, backPrizeId]);
  const secondPrizeIds = createPrizeIdSet(1, usedIds, endings, firstNumberIndex);
  const thirdPrizeIds = createPrizeIdSet(4, usedIds, endings, firstNumberIndex);
  const fourthPrizeIds = createPrizeIdSet(40, usedIds, endings, firstNumberIndex);

  return {
    purchased: 0,
    start: randomInt(UNIT_SIZE),
    step: createTraversalStep(),
    winning: {
      firstGroup,
      firstNumberIndex,
      firstPrizeId,
      frontPrizeId,
      backPrizeId,
      secondPrizeIds,
      thirdPrizeIds,
      fourthPrizeIds,
      ...endings,
    },
  };
}

function createEmptySummary() {
  return prizeTable.reduce((summary, prize) => {
    summary[prize.rank] = {
      count: 0,
      total: 0,
    };
    return summary;
  }, {});
}

function drawPrizeTable() {
  elements.prizeTable.innerHTML = prizeTable
    .map(
      (prize) => `
        <tr>
          <td>${prize.rank}</td>
          <td>${prize.oddsLabel}</td>
          <td>${formatYen(prize.prize)}</td>
        </tr>
      `
    )
    .join("");
}

function addHistory(prize, ticket, purchaseNumber, elapsedMs) {
  state.winSummary[prize.rank].count += 1;
  state.winSummary[prize.rank].total += prize.prize;

  state.history.unshift({
    rank: prize.rank,
    rankClass: getRankClass(prize.rank),
    prize: prize.prize,
    ticketLabel: formatTicketLabel(ticket),
    ticketMarkup: getTicketMarkup(ticket),
    purchaseNumber,
    elapsedMs,
  });

  if (state.history.length > MAX_HISTORY_ITEMS) {
    state.history.length = MAX_HISTORY_ITEMS;
  }
}

function getRankClass(rank) {
  const rankNumber = rank.match(/\d+/)?.[0] || "other";
  return `rank-${rankNumber}`;
}

function drawSummary() {
  elements.winSummary.innerHTML = prizeTable
    .map((prize) => {
      const summary = state.winSummary[prize.rank];
      return `
        <div class="summary-item ${getRankClass(prize.rank)}">
          <span>${prize.rank}</span>
          <strong>${integerFormatter.format(summary.count)}回</strong>
          <small>合計 ${formatYen(summary.total)}</small>
        </div>
      `;
    })
    .join("");
}

function drawHistory() {
  elements.historyCount.textContent = `${integerFormatter.format(state.history.length)}件`;

  if (state.history.length === 0) {
    elements.winHistory.innerHTML = '<li class="empty">まだ当選履歴はありません。</li>';
    return;
  }

  elements.winHistory.innerHTML = state.history
    .map(
      (item) => `
        <li class="${item.rankClass}">
          <span>${item.rank} ${formatYen(item.prize)}</span>
          <span>${item.ticketMarkup}<br>${formatTickets(item.purchaseNumber)}</span>
        </li>
      `
    )
    .join("");
}

function drawStats() {
  const spent = state.tickets * TICKET_PRICE;
  const profitLoss = state.returned - spent;
  const returnRate = spent === 0 ? 0 : (state.returned / spent) * 100;
  const realYears = getRealWorldYears(state.tickets);
  const soldOut = state.ticketSet.purchased >= UNIT_SIZE;

  elements.ticketsCount.textContent = formatTickets(state.tickets);
  elements.spentAmount.textContent = formatYen(spent);
  elements.returnedAmount.textContent = formatYen(state.returned);
  elements.profitLoss.textContent = formatYen(profitLoss);
  elements.profitLoss.classList.toggle("negative", profitLoss < 0);
  elements.profitLoss.classList.toggle("positive", profitLoss > 0);
  elements.returnRate.textContent = `${returnRate.toFixed(1)}%`;
  elements.elapsedTime.textContent = formatDuration(state.elapsedMs);
  elements.currentTicket.innerHTML = state.currentTicket
    ? getTicketMarkup(state.currentTicket)
    : "未購入";
  elements.ticketSetProgress.textContent =
    `${formatTickets(state.ticketSet.purchased)} / ${formatTickets(UNIT_SIZE)}`;
  elements.startButton.disabled = state.running || soldOut;
  elements.pauseButton.disabled = !state.running;
  elements.realWorldTime.textContent = `毎週10枚買った場合、約${yearsFormatter.format(realYears)}年分です`;

  if (state.firstPrize) {
    const firstPrizeYears = getRealWorldYears(state.firstPrize.ticketNumber);

    elements.firstPrizeStatus.innerHTML = [
      "一等に当選しました。",
      `購入枚数: ${formatTickets(state.firstPrize.ticketNumber)}`,
      `当選券: ${state.firstPrize.ticketLabel}`,
      `投入額: ${formatYen(state.firstPrize.ticketNumber * TICKET_PRICE)}`,
      `現実換算: 毎週10枚なら約${yearsFormatter.format(firstPrizeYears)}年目`,
      `経過時間: ${formatDuration(state.firstPrize.elapsedMs)}`,
    ].join("<br>");
  } else {
    elements.firstPrizeStatus.textContent = "未当選";
  }
}

function updateQuietMessage() {
  const minuteMark = Math.floor(state.elapsedMs / 30_000);
  if (!state.firstPrize && minuteMark > state.lastQuietMark) {
    state.lastQuietMark = minuteMark;
    elements.quietMessage.textContent =
      "まだ一等は出ていません。この退屈さが、極小確率です。";
  }
}

function draw() {
  drawStats();
  drawSummary();
  drawHistory();
  updateQuietMessage();
}

function getPrizeByRank(rank) {
  return prizeByRank[rank];
}

function evaluateTicket(ticket) {
  const winning = state.ticketSet.winning;

  if (ticket.id === winning.firstPrizeId) {
    return getPrizeByRank("1等");
  }

  if (ticket.id === winning.frontPrizeId || ticket.id === winning.backPrizeId) {
    return getPrizeByRank("1等の前後賞");
  }

  if (
    ticket.numberIndex === winning.firstNumberIndex &&
    ticket.group !== winning.firstGroup
  ) {
    return getPrizeByRank("1等の組違い賞");
  }

  if (winning.secondPrizeIds.has(ticket.id)) {
    return getPrizeByRank("2等");
  }

  if (winning.thirdPrizeIds.has(ticket.id)) {
    return getPrizeByRank("3等");
  }

  if (winning.fourthPrizeIds.has(ticket.id)) {
    return getPrizeByRank("4等");
  }

  if (winning.fifthEndings.has(ticket.numberIndex % 1000)) {
    return getPrizeByRank("5等");
  }

  if (ticket.numberIndex % 100 === winning.sixthEnding) {
    return getPrizeByRank("6等");
  }

  if (ticket.numberIndex % 10 === winning.seventhEnding) {
    return getPrizeByRank("7等");
  }

  return null;
}

function buyNextTicket() {
  if (state.ticketSet.purchased >= UNIT_SIZE) {
    return false;
  }

  const ticketSet = state.ticketSet;
  const id = (ticketSet.start + ticketSet.purchased * ticketSet.step) % UNIT_SIZE;
  const ticket = createTicketFromId(id);
  const purchaseNumber = state.tickets + 1;
  const prize = evaluateTicket(ticket);

  ticketSet.purchased += 1;
  state.tickets = purchaseNumber;
  state.currentTicket = ticket;

  if (!prize) {
    return true;
  }

  state.returned += prize.prize;
  addHistory(prize, ticket, purchaseNumber, state.elapsedMs);

  if (prize.rank === "1等" && !state.firstPrize) {
    state.firstPrize = {
      ticketNumber: purchaseNumber,
      ticketLabel: formatTicketLabel(ticket),
      elapsedMs: state.elapsedMs,
    };
    elements.quietMessage.textContent =
      "一等に当選しました。夢までの距離が、ようやく時間になりました。";
  }

  return true;
}

function simulateTickets(count) {
  let bought = 0;
  let soldOut = false;

  for (let i = 0; i < count; i += 1) {
    if (!buyNextTicket()) {
      soldOut = true;
      break;
    }
    bought += 1;
  }

  if (state.ticketSet.purchased >= UNIT_SIZE) {
    soldOut = true;
    pause();
    state.ticketCarry = 0;
    elements.startButton.disabled = true;
    elements.quietMessage.textContent =
      "このくじセットは完売しました。2,000万枚を買い切った結果を確認してください。";
  }

  return { bought, soldOut };
}

function step(timestamp) {
  if (!state.running) {
    return;
  }

  if (!state.lastFrameAt) {
    state.lastFrameAt = timestamp;
  }

  const deltaMs = Math.min(timestamp - state.lastFrameAt, 250);
  state.lastFrameAt = timestamp;
  state.elapsedMs += deltaMs;

  const { ticketsPerSecond } = getSelectedSpeedMode();
  state.ticketCarry += (ticketsPerSecond * deltaMs) / 1000;
  const ticketsToBuy = Math.floor(state.ticketCarry);

  if (ticketsToBuy > 0) {
    state.ticketCarry -= ticketsToBuy;
    const result = simulateTickets(ticketsToBuy);

    if (result.soldOut) {
      state.ticketCarry = 0;
    }
  }

  draw();
  requestAnimationFrame(step);
}

function start() {
  if (state.running || state.ticketSet.purchased >= UNIT_SIZE) {
    return;
  }

  state.running = true;
  state.lastFrameAt = 0;
  elements.startButton.disabled = true;
  elements.pauseButton.disabled = false;
  requestAnimationFrame(step);
}

function pause() {
  state.running = false;
  elements.startButton.disabled = false;
  elements.pauseButton.disabled = true;
}

function reset() {
  pause();
  state.tickets = 0;
  state.returned = 0;
  state.elapsedMs = 0;
  state.lastFrameAt = 0;
  state.ticketCarry = 0;
  state.history = [];
  state.winSummary = createEmptySummary();
  state.ticketSet = createUnit();
  state.currentTicket = null;
  state.firstPrize = null;
  state.lastQuietMark = 0;
  elements.quietMessage.textContent =
    "まだ一等は出ていません。この退屈さが、極小確率です。";
  draw();
}

elements.startButton.addEventListener("click", start);
elements.pauseButton.addEventListener("click", pause);
elements.resetButton.addEventListener("click", reset);
elements.speedSelect.addEventListener("change", draw);

drawPrizeTable();
draw();
