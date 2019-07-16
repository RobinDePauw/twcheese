/* global $, game_data */
import { initCss } from '/twcheese/src/Util/UI.js';
import { ImageSrc } from '/twcheese/conf/ImageSrc.js';
import { BattleReportCondensed } from '/twcheese/src/Models/BattleReportCondensed.js';
import { ReportRenamer } from '/twcheese/src/Models/ReportRenamer.js';
import { BattleReportScraper } from '/twcheese/src/Scrape/BattleReportScraper.js';
import { BattleReportCondensedScraper } from '/twcheese/src/Scrape/BattleReportCondensedScraper.js';
import { enhanceBattleReport } from '/twcheese/src/Transform/enhanceBattleReport.js';
import { ReportToolsWidget } from '/twcheese/src/Widget/ReportToolsWidget.js';
import { ReportListWidget } from '/twcheese/src/Widget/ReportListWidget.js';
import { userConfig, ensureRemoteConfigsUpdated } from '/twcheese/src/Util/Config.js';
import { requestDocument, gameUrl } from '/twcheese/src/Util/Network.js';
import { ProcessFactory } from '/twcheese/src/Models/Debug/Build/ProcessFactory.js';

import { processCfg as debugCfgDefault } from '/twcheese/dist/tool/cfg/debug/BRE/Default.js';

/*==== styles ====*/

// jquery-ui
initCss(`
    .ui-icon-gripsmall-diagonal-se { background-position: -64px -224px; }

    /* Icons
    ----------------------------------*/

    .ui-icon {
        display: block;
        text-indent: -99999px;
        overflow: hidden;
        background-repeat: no-repeat;
    }

    .ui-icon {
        width: 16px;
        height: 16px;
    }
    .ui-icon,
    .ui-widget-content .ui-icon {
        background-image: url(${ImageSrc.jq.darkGrey});
    }
    .ui-widget-header .ui-icon {
        background-image: url(${ImageSrc.jq.black});
    }
    .ui-state-default .ui-icon {
        background-image: url(${ImageSrc.jq.grey});
    }
    .ui-state-hover .ui-icon,
    .ui-state-focus .ui-icon {
        background-image: url(${ImageSrc.jq.darkGrey});
    }
    .ui-state-active .ui-icon {
        background-image: url(${ImageSrc.jq.darkGrey});
    }
    .ui-state-highlight .ui-icon {
        background-image: url(${ImageSrc.jq.blue});
    }
    .ui-state-error .ui-icon,
    .ui-state-error-text .ui-icon {
        background-image: url(${ImageSrc.jq.red});
    }

    /* Overlays */
    .ui-widget-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
    .ui-resizable {
        position: relative;
    }
    .ui-resizable-handle {
        position: absolute;
        font-size: 0.1px;
        display: block;
    }
    .ui-resizable-disabled .ui-resizable-handle,
    .ui-resizable-autohide .ui-resizable-handle {
        display: none;
    }
    .ui-resizable-n {
        cursor: n-resize;
        height: 7px;
        width: 100%;
        top: -5px;
        left: 0;
    }
    .ui-resizable-s {
        cursor: s-resize;
        height: 7px;
        width: 100%;
        bottom: -5px;
        left: 0;
    }
    .ui-resizable-e {
        cursor: e-resize;
        width: 7px;
        right: -5px;
        top: 0;
        height: 100%;
    }
    .ui-resizable-w {
        cursor: w-resize;
        width: 7px;
        left: -5px;
        top: 0;
        height: 100%;
    }
    .ui-resizable-se {
        cursor: se-resize;
        width: 12px;
        height: 12px;
        right: 1px;
        bottom: 1px;
    }
    .ui-resizable-sw {
        cursor: sw-resize;
        width: 9px;
        height: 9px;
        left: -5px;
        bottom: -5px;
    }
    .ui-resizable-nw {
        cursor: nw-resize;
        width: 9px;
        height: 9px;
        left: -5px;
        top: -5px;
    }
    .ui-resizable-ne {
        cursor: ne-resize;
        width: 9px;
        height: 9px;
        right: -5px;
        top: -5px;
    }

    /* twcheese */
`);

// twcheese
initCss(`
    #twcheese_reportsFolder {
        margin-bottom: 30px;
    }
`);

// language /////////////////////////////////////////////////////////////////////

var language = { "twcheese": {} };
switch (game_data.market) {
    default:
        /*==== tribalwars.net, tribalwars.us, tribalwars.co.uk, beta.tribalwars.net ====*/
        language['twcheese']['Help'] = 'Help';
        language['twcheese']['noReportsSelected'] = 'You haven\'t selected any reports to be renamed.';
        break;

    case 'cz':
        /*==== divokekmeny.cz/ ====*/
        language['twcheese']['Help'] = 'Pomoc';
        language['twcheese']['noReportsSelected'] = 'Nejdříve si musíte vybrat, které zprávy přejmenovat.';
        break;

    case 'se':
        language['twcheese']['Help'] = 'Hjälp';
        language['twcheese']['noReportsSelected'] = 'Du har inte valt några rapporter som skall döpas om.';
        break;

    /*==== fyletikesmaxes.gr/ ====*/
    case 'gr':
        language['twcheese']['Help'] = 'Βοήθεια';
        language['twcheese']['noReportsSelected'] = 'Δεν έχεις επιλέξει  καμιά αναφορά για μετονομασία';
        break;

    /* Norwegian */
    case 'no':
        language['twcheese']['Help'] = 'Hjelp';
        language['twcheese']['noReportsSelected'] = 'Du har ikke valgt hvilke rapporter som skal endres navn på.';
        break;
                        
}



/*==== page modifier functions ====*/


/**
 * modifies page on the reports folder view
 * @param {HTMLDocument} gameDoc the document from game.php?screen=report&mode=attack
 * @param {ReportRenamer} renamer
 */
function twcheese_BattleReportsFolderEnhancer(gameDoc, renamer) {

    /*==== find reports table ====*/
    /* note: premium players have a table with links to folders. regular players don't. But the layout seems to have changed again */
    var reportsTable;
    if (window.premium)
        reportsTable = gameDoc.getElementById('content_value').getElementsByTagName('table')[3];
    else
        reportsTable = gameDoc.getElementById('content_value').getElementsByTagName('table')[3];

    var reportsForm = reportsTable.parentNode;

    /*==== scrape reports information ====*/    
    let reportScraper = new BattleReportCondensedScraper(renamer);
    let reports = reportScraper.scrapeReports(reportsTable);

    /*==== remove old table ====*/
    reportsTable.parentNode.removeChild(reportsTable);

    /*==== create twcheese reports folder ====*/
    var reportsFolder = document.createElement('div');
    reportsForm.insertBefore(reportsFolder, reportsForm.firstChild);
    reportsFolder.id = 'twcheese_reportsFolder';

    /*==== reports folder toolbar ====*/
    var reportsFolderToolbar = document.createElement('div');
    reportsFolder.appendChild(reportsFolderToolbar);
    reportsFolderToolbar.id = 'twcheese_reportsFolderToolbar';

    reportsFolderToolbar.currentPanel = 'none';
    reportsFolderToolbar.toggleDisplayConfig = function () {
        if (this.currentPanel == 'displayConfig') {
            document.getElementById('twcheese_displayConfig_tab').className = '';
            document.getElementById('twcheese_reportsFolderSettings').style.display = 'none';
            this.currentPanel = 'none';
        }
        else {
            document.getElementById('twcheese_displayConfig_tab').className = 'selected';
            document.getElementById('twcheese_export_tab').className = '';
            document.getElementById('twcheese_reportsFolderSettings').style.display = '';
            document.getElementById('twcheese_reportsFolderExport').style.display = 'none';
            this.currentPanel = 'displayConfig';
        }
    };

    reportsFolderToolbar.toggleExport = function () {
        if (this.currentPanel == 'exportLinks') {
            document.getElementById('twcheese_export_tab').className = '';
            document.getElementById('twcheese_reportsFolderExport').style.display = 'none';
            this.currentPanel = 'none';
        }
        else {
            document.getElementById('twcheese_export_tab').className = 'selected';
            document.getElementById('twcheese_displayConfig_tab').className = '';
            document.getElementById('twcheese_reportsFolderExport').style.display = '';
            document.getElementById('twcheese_reportsFolderSettings').style.display = 'none';
            this.currentPanel = 'exportLinks';
        }
    };

    /*==== toolbar tabs ====*/
    reportsFolderToolbar.innerHTML += `
        <table style="border-style:solid; border-width:0px;" class="vis modemenu">
            <tbody>
                <tr>
                    <td id="twcheese_displayConfig_tab" style="border-style:solid; border-width:1px; cursor:default;" onclick="document.getElementById(\'twcheese_reportsFolderToolbar\').toggleDisplayConfig();">
                        <a>configure display</a>
                    </td>
                    <td id="twcheese_export_tab" style="border-style:solid; border-width:1px; cursor:default;" onclick="document.getElementById(\'twcheese_reportsFolderToolbar\').toggleExport();">
                        <a>export repeat-attack links</a>
                    </td>
                </tr>
            </tbody>
        </table>`;


    /*==== export repeatLinks div ====*/
    var reportsFolderExportContainer = document.createElement('table');
    reportsFolderToolbar.appendChild(reportsFolderExportContainer);
    reportsFolderExportContainer.id = 'twcheese_reportsFolderExport';
    reportsFolderExportContainer.style.display = 'none';

    reportsFolderExportContainer.insertRow(-1);
    reportsFolderExportContainer.rows[0].insertCell(-1);
    reportsFolderExportContainer.rows[0].insertCell(-1);
    reportsFolderExportContainer.rows[0].cells[0].innerHTML += '<textarea rows=10 cols=40 />';

    /*==== export repeatLinks configuration table ====*/
    var exportConfigTable = document.createElement('table');
    exportConfigTable.id = 'twcheese_exportConfigTable';
    reportsFolderExportContainer.rows[0].cells[1].appendChild(exportConfigTable);

    exportConfigTable.insertRow(-1);
    exportConfigTable.rows[0].appendChild(document.createElement('th'));
    exportConfigTable.rows[0].cells[0].innerHTML = 'Format';
    exportConfigTable.rows[0].appendChild(document.createElement('th'));
    exportConfigTable.rows[0].cells[1].innerHTML = 'Attacking Village';

    exportConfigTable.insertRow(-1);
    exportConfigTable.rows[1].insertCell(-1);
    exportConfigTable.rows[1].cells[0].innerHTML = `
        <input type="radio" name="twcheese-repeat-attack-export-format" checked="true" value="bbcode"/> BBCode
        <br/><input type="radio" name="twcheese-repeat-attack-export-format" value="plainLink"/> plain links
        <br/><input type="radio" name="twcheese-repeat-attack-export-format" value="html"/> HTML`;

    exportConfigTable.rows[1].insertCell(-1);
    exportConfigTable.rows[1].cells[1].innerHTML = `
        <input type="radio" name="twcheese-repeat-attack-export-village" checked="true" value="current"/> current village
        <br/><input type="radio" name="twcheese-repeat-attack-export-village" value="original"/> original village`;

    exportConfigTable.insertRow(-1);
    exportConfigTable.rows[2].insertCell(-1);
    exportConfigTable.rows[2].cells[0].colSpan = 2;
    exportConfigTable.rows[2].cells[0].innerHTML = 'Header: <input type="text" id="twcheese_export_header" value="new cheesy attack group" onclick="if(this.value==\'new cheesy attack group\')this.value=\'\';" />';

    exportConfigTable.insertRow(-1);
    exportConfigTable.rows[3].insertCell(-1);
    exportConfigTable.rows[3].cells[0].colSpan = 2;
    exportConfigTable.rows[3].cells[0].innerHTML = '<a href="javascript:document.getElementById(\'twcheese_reportsFolderExport\').exportLinks();" > &raquo; Export</a>';

    reportsFolderExportContainer.exportLinks = function () {
        var reportsTable = document.getElementById('twcheese_reportsTable_body'); // todo: don't use elements to get reports

        let format = $("input[name='twcheese-repeat-attack-export-format']:checked").val();
        let attackingVillage = $("input[name='twcheese-repeat-attack-export-village']:checked").val();

        var header = document.getElementById('twcheese_export_header').value;


        function buildHeader() {
            switch (format) {
                case 'bbcode':
                    return `[b][u][size=12]${header}[/size][/u][/b]`;

                case 'plainLink':
                    return header;

                case 'html':
                    return [
                        '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
                        `\n<DT><H3>${header}</H3></DT>\n<DL><P>`
                    ].join('');
            }
        }


        function urlCurrentVillage(twcheeseReport) {
            return gameUrl('place', {try: 'confirm', type: 'same', report_id: twcheeseReport.reportId});
        }

        function buildEntryCurrentVillage(twcheeseReport) {
            switch (format) {
                case 'bbcode':
                    return '\n[url=' + urlCurrentVillage(twcheeseReport) + ']repeat attack ' + twcheeseReport.reportId + ' from (' + game_data.village.coord + ') to (' + twcheeseReport.defenderVillage.x + '|' + twcheeseReport.defenderVillage.y + ')[/url]';

                case 'plainLink':
                    return '\n' + urlCurrentVillage(twcheeseReport);

                case 'html':
                    let leadingZero = '';
                    let distance = twcheeseReport.defenderDistance(game_data.village);
                    if (distance < 10) {
                        leadingZero = '0';
                    }
                    return '\n<DT><A HREF="' + urlCurrentVillage(twcheeseReport) + '" >' + leadingZero + distance + ' Repeat Attack ' + twcheeseReport.reportId + ' from (' + game_data.village.coord + ') to (' + twcheeseReport.defenderVillage.x + '|' + twcheeseReport.defenderVillage.y + ')</A></DT>';                
            }
        }


        function urlOriginalVillage(twcheeseReport) {
            return gameUrl('place', {try: 'confirm', type: 'same', report_id: twcheeseReport.reportId, village: twcheeseReport.attackerVillage.id});
        }

        function buildEntryOriginalVillage(twcheeseReport) {
            switch (format) {
                case 'bbcode':
                    return '\n[url=' + urlOriginalVillage(twcheeseReport) + ']repeat attack ' + twcheeseReport.reportId + ' from (' + twcheeseReport.attackerVillage.x + '|' + twcheeseReport.attackerVillage.y + ') to (' + twcheeseReport.defenderVillage.x + '|' + twcheeseReport.defenderVillage.y + ')[/url]';

                case 'plainLink':
                    return '\n' + urlOriginalVillage(twcheeseReport);

                case 'html':
                    return '\n<DT><A HREF="' + urlOriginalVillage(twcheeseReport) + '" >Repeat Attack ' + twcheeseReport.reportId + ' from (' + twcheeseReport.attackerVillage.x + '|' + twcheeseReport.attackerVillage.y + ') to (' + twcheeseReport.defenderVillage.x + '|' + twcheeseReport.defenderVillage.y + ')</A></DT>';
            }
        }

        var exportString = buildHeader();

        for (let i = 1; i < reportsTable.rows.length; i++) {
            let twcheeseReport = reportsTable.rows[i].twcheeseReport;
            if (!twcheeseReport.defenderVillage) {
                continue; // not enough information
            }
            if (twcheeseReport.attackerName !== game_data.player.name) {
                continue; // can't repeat somebody else's attack
            }
            if (attackingVillage == 'current') {
                exportString += buildEntryCurrentVillage(twcheeseReport);
            }
            else if (attackingVillage == 'original' && twcheeseReport.attackerVillage) {
                exportString += buildEntryOriginalVillage(twcheeseReport);
            } 
        }

        if (format === 'html') {
            exportString += '\n</P></DL>';
        }

        document.getElementById('twcheese_reportsFolderExport').getElementsByTagName('textarea')[0].value = exportString;
    };


    /*==== display settings ====*/
    var reportsFolderSettingsDiv = document.createElement('div');
    reportsFolderToolbar.appendChild(reportsFolderSettingsDiv);
    reportsFolderSettingsDiv.id = 'twcheese_reportsFolderSettings';
    reportsFolderSettingsDiv.style.display = 'none';
    reportsFolderSettingsDiv.style.columnWidth = 200 + 'px';
    
    function insertCheckbox(key, text) {
        let $el = $(`<div style="white-space:nowrap"><label><input data-setting-name="${key}" type="checkbox"> ${text}</label></div>`);
        $el.find('input').on('click', () => {
            reportListWidget.toggleReportsColumns(key);
        });
        reportsFolderSettingsDiv.appendChild($el[0]);
    }
    
    for (let category of ReportListWidget.columnCategories) {
        if (!category.hideable) {
            continue;
        }
        insertCheckbox(category.key, category.description);
    }

    /*==== reports display ====*/
    let reportListWidget = new ReportListWidget(reports, reportsFolder);
    reportListWidget.populateReportsTable();
    reportListWidget.applySettings();

    /**
     *	note: changed from a loop to recursive method in 2.2 to allow redrawing of progress in IE via setTimeout method
     *	@param reportIds:Array(reportID:String)	an array of reportIDs for reports that still need to be renamed
     *	@param total:Number		the total amount of reports that will have been renamed
     */
    this.massRename = async function (reportIds, total) {
        if (!reportIds) {
            reportIds = reportListWidget.getSelectedReportIds();
            document.getElementById('twcheese_progress_count_max').innerHTML = reportIds.length;
            total = reportIds.length;
        }
        var estimatedTimeRemaining;

        /*==== rename reports 1 by 1 ====*/
        if (reportIds.length == 0) {
            document.getElementById('twcheese_progress_count').innerHTML = 0;
            window.UI.ErrorMessage(language['twcheese']['noReportsSelected'], 3000);
        }
        else {
            var reportId = reportIds.shift();
            var startTime = performance.now();

            let reportDoc = await requestDocument(gameUrl('report', {mode: game_data.mode, view: reportId}));

            try {
                let scraper = new BattleReportScraper(reportDoc);
                let fullReport = scraper.scrapeReport();
                let name = await renamer.rename(fullReport, '');

                $('.quickedit[data-id="' + reportId + '"]')
                    .find('.quickedit-label').html(name);

                /*==== update reports information so row can be redrawn with updated information====*/
                let row = document.getElementsByName('id_' + reportId)[0].parentNode.parentNode;
                let oldReport = row.twcheeseReport; // todo: don't use rows

                let report = renamer.parseName(name);
                report.reportId = reportId;
                report.dotColor = oldReport.dotColor;
                report.haulStatus = oldReport.haulStatus;
                report.isForwarded = oldReport.isForwarded;
                report.strTimeReceived = oldReport.strTimeReceived;

                row.twcheeseReport = report;
                reportListWidget.reports[row.rowIndex - 1] = report;


                /*==== update progress display ====*/
                var millisElapsed = performance.now() - startTime;
                estimatedTimeRemaining = (millisElapsed * reportIds.length) / 1000;
                var minutesRemaining = Math.floor(estimatedTimeRemaining / 60);
                var secondsRemaining = Math.round(estimatedTimeRemaining - (minutesRemaining * 60));
                if (minutesRemaining < 10)
                    minutesRemaining = '0' + minutesRemaining;
                if (secondsRemaining < 10)
                    secondsRemaining = '0' + secondsRemaining;
                document.getElementById('twcheese_time_remaining').innerHTML = minutesRemaining; //minutes
                document.getElementById('twcheese_time_remaining').innerHTML += ':' + secondsRemaining; //seconds
                document.getElementById('twcheese_progress_count').innerHTML = Number(total - reportIds.length);
                document.getElementById('twcheese_progress_percent').innerHTML = Number(Math.round((total - reportIds.length) / total * 100));
            }
            catch (e) {
                console.error('error renaming report:', e);
            }

            if (reportIds.length > 0)
                setTimeout(() => { this.massRename(reportIds, total) }, 1);
            else {
                reportListWidget.refreshContents();
            }
        }
    };


    /*==== reports selector bar ====*/
    var reportsSelectorBar = document.createElement('div');
    reportsFolder.appendChild(reportsSelectorBar);
    reportsSelectorBar.id = 'twcheese_reportsSelectorBar';
    reportsSelectorBar.style.borderStyle = 'solid';
    reportsSelectorBar.style.borderWidth = '1px';

    /*==== label ====*/
    var reportsSelectorBarLabel = document.createElement('div');
    reportsSelectorBar.appendChild(reportsSelectorBarLabel);
    reportsSelectorBarLabel.style.backgroundColor = 'rgb(193, 162, 100) !important';
    reportsSelectorBarLabel.style.backgroundImage = 'linear-gradient(rgb(229,194,126), rgb(193,162,100))';
    reportsSelectorBarLabel.style.backgroundRepeat = 'repeat-x';
    reportsSelectorBarLabel.style.fontSize = '9pt';
    reportsSelectorBarLabel.style.fontWeight = '700';
    reportsSelectorBarLabel.innerHTML = 'SELECT';
    reportsSelectorBarLabel.style.height = '18px';
    reportsSelectorBarLabel.style.paddingLeft = '3px';

    /*==== clicky table ====*/
    var selectorClickyTable = document.createElement('table');
    reportsSelectorBar.appendChild(selectorClickyTable);
    selectorClickyTable.className = 'vis';
    selectorClickyTable.insertRow(-1);

    let imgHtml = src => `<img style="display:block; margin-left:auto; margin-right:auto" src="${src}"/>`;

    let clickyOptions = new Map([
        ['all', {
            click: () => reportListWidget.selectAll(),
            html: 'all'
        }],
        ['none', {
            click: () => reportListWidget.selectNone(),
            html: 'none'
        }],
        ['new', {
            click: () => reportListWidget.selectNew(),
            html: 'new'
        }],
        ['old', {
            click: () => reportListWidget.selectOld(),
            html: 'old'
        }],
        ['dotGreen', {
            click: () => reportListWidget.selectDotColor('green'),
            html: imgHtml('graphic/dots/green.png')
        }],
        ['dotYellow', {
            click: () => reportListWidget.selectDotColor('yellow'),
            html: imgHtml('graphic/dots/yellow.png')
        }],
        ['dotRed', {
            click: () => reportListWidget.selectDotColor('red'),
            html: imgHtml('graphic/dots/red.png')
        }],
        ['dotBlue', {
            click: () => reportListWidget.selectDotColor('blue'),
            html: imgHtml('graphic/dots/blue.png')
        }],
        ['forwarded', {
            click: () => reportListWidget.selectForwarded(),
            html: imgHtml('graphic/forwarded.png')
        }],
        ['haulPartial', {
            click: () => reportListWidget.selectLoot(BattleReportCondensed.HAUL_STATUS_PARTIAL),
            html: imgHtml('graphic/max_loot/0.png')
        }],
        ['haulFull', {
            click: () => reportListWidget.selectLoot(BattleReportCondensed.HAUL_STATUS_FULL),
            html: imgHtml('graphic/max_loot/1.png')
        }],
        ['feint', {
            click: () => reportListWidget.selectFeint(),
            html: imgHtml('graphic/dots/grey.png'),
            tooltip: 'feint'
        }],
        ['deadNoble', {
            click: () => reportListWidget.selectDeadNoble(),
            html: imgHtml(ImageSrc.troopIcon('priest')),
            tooltip: 'dead noble'
        }],
        ['loyalty', {
            click: () => reportListWidget.selectLoyalty(),
            html: '<span style="display:block; margin-left:auto; margin-right:auto" class="icon ally lead"/>',
            tooltip: 'loyalty change'
        }],
        ['cleared', {
            click: () => reportListWidget.selectCleared(),
            html: 'defenseless'
        }]
    ]);

    for (let [descriptor, option] of clickyOptions) {
        let optionEl = $(`<a href="#">${option.html}</a>`)[0];
        if (option.tooltip) {
            optionEl.title = option.tooltip;
        }
        optionEl.addEventListener('click', function(e) {
            e.preventDefault();
            option.click();
        });

        let cell = selectorClickyTable.rows[0].insertCell(-1);
        cell.style.width = '25px';
        cell.style.textAlign = 'center';        
        cell.appendChild(optionEl);
    }

    /*==== input table ====*/
    var selectorInputTable = document.createElement('table');
    reportsSelectorBar.appendChild(selectorInputTable);
    selectorInputTable.className = 'vis';
    selectorInputTable.insertRow(-1);

    let inputOptions = [
        {
            hintInput: 'contains text',
            hintButton: 'select text',
            use: () => reportListWidget.selectText(),
            sprite: [-140, 0]
        },
        {
            hintInput: 'attacker',
            hintButton: 'select attacking player',
            use: () => reportListWidget.selectAttacker(),
            sprite: [-80, 0]
        },
        {
            hintInput: 'defender',
            hintButton: 'select defending player',
            use: reportListWidget.selectDefender,
            sprite: [-80, 0]
        },
        {
            hintInput: 'origin',
            hintButton: 'select attacking village',
            placeholder: 'x|y',
            use: reportListWidget.selectAttackerVillage,
            sprite: [-120, 0]
        },
        {
            hintInput: 'target',
            hintButton: 'select defending village',
            placeholder: 'x|y',
            use: reportListWidget.selectDefenderVillage,
            sprite: [-120, 0]
        }
    ];

    for (let option of inputOptions) {
        let input = document.createElement('input');
        input.type = 'text';
        input.size = 10;
        input.value = option.hintInput;
        input.placeholder = option.placeholder || '';
        let alreadyCleared = false;
        input.addEventListener('mousedown', function() {
            if (alreadyCleared) {
                return;
            }
            this.value = '';
            alreadyCleared = true;
        });

        let $button = $(`<a href="#" title="${option.hintButton}"></a>`)
            .on('click', function(e) {
                e.preventDefault();
                option.use(input.value);
            });

        let $buttonIcon = $('<span>&nbsp;</span>')
            .css({
                display: 'inline-block',
                background: `url(graphic/bbcodes/bbcodes.png) no-repeat ${option.sprite[0]}px ${option.sprite[1]}px`,
                paddingLeft: 0,
                paddingBottom: 0,
                margin: 3,
                width: 20,
                height: 20
            });

        $button.append($buttonIcon);

        let cell = selectorInputTable.rows[0].insertCell(-1);
        cell.appendChild(input);
        cell.appendChild($button[0]);
    }

    /*==== mass rename table ===*/

    // note: non-premium accounts cannot rename reports
    if (window.premium) {
        let $massRename = $(`
            <table class="vis">
                <tbody>
                    <tr>
                        <td>
                            <a href="#">&raquo; Rename</a>
                            <img src="/graphic/questionmark.png?1" width="13" height="13" title="rename selected reports to twCheese format">
                        </td>
                        <td style="textAlign: right;">Progress:</td>
                        <td style="width: 40px;"><span id="twcheese_progress_percent">0</span>%</td>
                        <td style="width: 136px;">(<span id="twcheese_progress_count">0</span>/<span id="twcheese_progress_count_max">0</span> reports)</td>
                        <td>time remaining: <span id="twcheese_time_remaining">00:00</span></td>
                    </tr>
                </tbody>
            </table>
        `.trim());
        $massRename.find('a').on('click', (e) => {
            e.preventDefault();
            this.massRename();
        });
        $massRename.appendTo(reportsFolder);
    }

}

/**
 *	@param	text:String	text to be displayed inside the button
 *	@param	address:String	(optional) if included, causes the button to open a new window when clicked, directing the page to the specified address
 */
function createFooterButton(text, address) {
    var twcheese_menu = document.createElement('div');
    twcheese_menu.style.textAlign = 'center';

    var twcheese_menu_text = document.createElement('p');
    twcheese_menu_text.style.fontSize = '9pt';
    twcheese_menu_text.innerHTML = text;
    /*twcheese_menu_text.style.fontFamily = '"Comic Sans MS", cursive, sans-serif';*/
    twcheese_menu_text.style.fontWeight = '700';
    twcheese_menu_text.style.marginTop = '3px';
    twcheese_menu_text.style.color = '#422301';
    twcheese_menu.appendChild(twcheese_menu_text);

    twcheese_menu.style.background = `url("${ImageSrc.legacy.helpBackground}")`;
    twcheese_menu.style.height = '22px';
    twcheese_menu.style.width = '49px';
    twcheese_menu.style.display = 'block';
    twcheese_menu.style.position = 'fixed';
    twcheese_menu.style.left = '100%';
    twcheese_menu.style.top = '100%';
    twcheese_menu.style.marginTop = '-24px';
    twcheese_menu.style.marginLeft = '-52px';
    twcheese_menu.style.zIndex = '99999999999';

    twcheese_menu.onmouseover = function () { this.style.background = `url("${ImageSrc.legacy.helpBackgroundBright}")` };
    twcheese_menu.onmouseout = function () { this.style.background = `url("${ImageSrc.legacy.helpBackground}")` };

    if (address) {
        twcheese_menu.style.cursor = 'pointer';
        twcheese_menu.onclick = function () { window.open(address, 'twcheese_menu_window') };
    }
    else
        twcheese_menu.style.cursor = 'default';

    return document.body.appendChild(twcheese_menu);
};


/*==== main ====*/

let initialized = false;
let reportEnhanced = false;
let reportsFolderEnhanced = false;

async function useTool() {
    if (!initialized) {
        await ensureRemoteConfigsUpdated();
        initBRE();
        initialized = true;
    }

    if (game_data.screen == 'report' && document.URL.includes('&view=')) {
        // user is viewing single report
        if (!reportEnhanced) {
            enhanceReport();
            reportEnhanced = true;
        }
    }
    else if (game_data.screen == 'report' && (game_data.mode == 'attack' || game_data.mode == 'defense')) {
        // user is viewing reports folder with 'Attacks' or "Defenses" filter on
        if (!reportsFolderEnhanced) {
            enhanceReportsFolder();
            reportsFolderEnhanced = true;
        }
    }
    else {
        alert('try using this on:\n1) a battle report\n2) a reports folder, with the "Attacks" filter on\n3) a reports folder, with the "Defenses" filter on');
    }
}


function initBRE() {

    /*==== contact information ====*/
    var narcismDiv = document.createElement('div');
    document.getElementById('content_value').insertBefore(narcismDiv, document.getElementById('content_value').firstChild);
    narcismDiv.innerHTML = 'BRE created by <a href="https://forum.tribalwars.net/index.php?members/28484">cheesasaurus</a>';
    narcismDiv.style.fontSize = '10px';

    /*==== help ====*/
    createFooterButton(language['twcheese']['Help'], 'https://forum.tribalwars.net/index.php?threads/256225/');
}


function enhanceReport() {
    let scraper = new BattleReportScraper(document);
    let report = scraper.scrapeReport();

    let renamer = new ReportRenamer();

    $(renamer).on('report-renamed', function(e) {
        $('.quickedit[data-id="' + e.reportId + '"]')
            .find('.quickedit-label')
            .html(e.newName);
    });

    if (userConfig.get('BattleReportEnhancer.autoRename', false)) {
        renamer.rename(report, '');
    }

    enhanceBattleReport(document, report);

    (new ReportToolsWidget(report, renamer))
        .insertBefore($('#content_value').find('h2').eq(0));
}


function enhanceReportsFolder() {
    let renamer = new ReportRenamer();
    let pageMod = new twcheese_BattleReportsFolderEnhancer(document, renamer);
}


// register tool ///////////////////////////////////////////////////////

let processFactory = new ProcessFactory({});

function newDebugProcess() {
    let name = 'Tool: Battle Report Enhancer';
    return processFactory.create(name, debugCfgDefault, true);
}


window.TwCheese.registerTool({
    id: 'BRE',
    use: useTool,
    getDebugProcess: newDebugProcess
});