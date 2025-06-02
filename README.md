# Download GEDCOM

Chrome extension for downloading a GEDCOM file of a FamilySearch person's
detail page.

This inserts a download button next to the person's name. The button is
enabled when on the Details section. The file contains vital information as
well as parents, spouses and children. A note is added with a text version
of the data as well as a source field attribution to FamilySearch.

## Installation

Copy the _downloadGedcom_ folder to a permanent location such as your
Documents folder. In Chrome, navigate to chrome://extensions/ and select **Load
Unpacked**. Select the downloadGedcom folder and choose **Select**. Now when
you go to a FamilySearch person page, you should see a Download button next to
the person's name at the top of the page.

## Known issues

No data from a person's "Other Information" is included (Alternate Names,
Events, Facts). Only data from the "Vitals" and "Family Members" section is
currently scraped.

GEDCOM supports separate sections for name suffixes and prefixes but these
are not included in this version. There may be names where the last name is
incorrectly identified.

The Sources listed in the Sources tab for a person are also not included. The
URL for the person is the single source listed for the GEDCOM file.

## Future

Aside from addressing the issues above, a nice feature would be to allow
marking a collection of persons and exporting a GEDCOM file with those members.
