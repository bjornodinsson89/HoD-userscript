function getStatusValue(status, mode) {
    if (mode === 0) { // online > idle > offline
        if (status === 'online') return 2;
        if (status === 'idle') return 1;
        if (status === 'offline') return 0;
    } else if (mode === 1) { // idle > online > offline
        if (status === 'idle') return 2;
        if (status === 'online') return 1;
        if (status === 'offline') return 0;
    } else if (mode === 2) { // offline > idle > online
        if (status === 'offline') return 2;
        if (status === 'idle') return 1;
        if (status === 'online') return 0;
    }
    return -1;
}
