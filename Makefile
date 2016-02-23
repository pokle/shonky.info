push:
	aws s3 sync public s3://shonky.info --grants read=uri=http://acs.amazonaws.com/groups/global/AllUsers

pull:
	aws s3 sync s3://shonky.info public