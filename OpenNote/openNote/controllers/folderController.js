
openNote.controller("folderController", function(	$scope, 
													$rootScope, 
													$location, 
													$routeParams, 
													storageService, 
													config,
													$timeout) {
	$rootScope.buttons = [];
	$scope.folderEditMode = false;
	$scope.currentFolder = {};
	
	//add buttons
		if($routeParams.id!=null)
			$rootScope.buttons.push({
				text: "New note",
				action: function(){
					$scope.fadeOutFoldersAndNotes(function(){
						$location.url("/note/").search("folderID",$scope.currentFolder._id);
					});
				},
				helpText: $rootScope.helpContent.newNoteButton
			});
		
		//Create a folder
			$rootScope.buttons.push({
				text: "New folder",
				action: function(){
					var prompt = "Please enter a name for the new folder";
					
					if($scope.currentFolder.name!=null)
						prompt += "that will be created in "+$scope.currentFolder.name;
					
					alertify.prompt(	
						prompt,
						function(confirm,data){
							if(!confirm)
								return;
							
							var folder = {
									parentFolderID:$scope.currentFolder._id,
									name:data
							};
							
							createFolder(folder);
						},
						"");
				},
				helpText: $rootScope.helpContent.newFolderButton
			});
		
		$rootScope.buttons.push({
			text: "Search",
			action: function(){
				$location.url("/search/"+$scope.currentFolder.id);
			},
			helpText: $rootScope.helpContent.findButton
		});
		
	/**	
	 * Load current folder contents
	 */
	$timeout(function(){
		//Load the folder
		if($routeParams.id==null){
			$scope.currentFolder={
					_id:null,
					name:"Home"};
			loadCurrentFolderContents();
		}
		else{
			storageService.database().get($routeParams.id).then(function(doc){
				$scope.currentFolder=doc;
				loadCurrentFolderContents();
			});	
		}
	});
	
	/**
	 * Activate folder edit mode if we are not in the home folder
	 */
	$scope.activateFolderEditMode = function(){
		if($scope.currentFolder._id != null)
			$scope.folderEditMode = !$scope.folderEditMode;
	};
	
	/**
	 * fade out all folders
	 */
	$scope.fadeOutFoldersAndNotes = function(callback){
		if(		(	$scope.currentFolder.foldersInside !=null 
				&& 	$scope.currentFolder.foldersInside.length>0)
			||	(	$scope.currentFolder.notesInside !=null 
				&& 	$scope.currentFolder.notesInside.length>0)){
			
			$(".note").fadeTo(config.fadeSpeedShort(),0,function(){
				$scope.$apply(function(){
					callback();
				});
			});
			
			$(".folder").fadeTo(config.fadeSpeedShort(),0,function(){
				$scope.$apply(function(){
					callback();
				});
			});
		}
		else
			callback();
	};
	
	/**
	 * Load a folder
	 * @param folder- the folder to load
	 */
	$scope.loadFolder = function(folder){
		$scope.fadeOutFoldersAndNotes(function(){
			$location.url("/folder/"+folder.doc._id);
		});
	};
	
	/**
	 * Load parent folder
	 */
	$scope.loadParentFolder = function(){//FIXME
		$scope.fadeOutFoldersAndNotes(function(){
			if($scope.currentFolder.parentFolderID!=null)
				$location.url("/folder/"+$scope.currentFolder.parentFolderID);
			else
				$location.url("/folder/");
		});
	};
	
	/**
	 * Load a note
	 * @param note - load a note
	 */
	$scope.loadNote = function(note){
		$scope.fadeOutFoldersAndNotes(function(){
			$location.url("/note/"+note.id);
		});
	};
	
	/**
	 * Rename the current folder
	 */
	$scope.renameFolder = function(){
		alertify.prompt("Rename "+$scope.currentFolder.name+" to:",
			function(confirm,data){
				if(!confirm)
					return;
			
				$scope.currentFolder.name=data;
				storageService.database().put($scope.currentFolder).then(function(result){
					$rootScope.$emit("reloadListView", {});
					$scope.$apply();
				}).catch(function(error){
					console.log(error);
					//FIXME
				});
			},		
			$scope.currentFolder.name//show the current folder name
		);
	};
	
	/**
	 * Remove this folder and all sub items
	 */
	$scope.removeFolder = function(){//FIXME Clear orphans
		alertify.confirm("Are you sure you want to delete "+$scope.currentFolder.name+" and all subfolders and notes it contains?",
			function(confirm) {
				if(!confirm)
					return;
					
				var parrentFolderID = $scope.currentFolder.parrentFolderID;
				storageService.database().remove($scope.currentFolder).then(function(result){
					$rootScope.$emit("reloadListView", {});
					
					if(parrentFolderID==null)
						$location.url("/folder/");
					else
						$location.url("/folder/"+parrentFolderID);
					
					$scope.$apply();
				}).catch(function(error){
					console.log(error);
					//FIXME
				});
			});
	}
	
	/**
	 * Listen to changed folder events to see if its the current open folder
	 */
	$rootScope.$on("changedFolder", function(event, request) {
	    if(request.folder.parrentFolderID==$scope.currentFolder.id || $scope.currentFolder.id==request.oldParrentFolderID){//does the change effect us?
	    	$scope.currentFolder.$get({id:$scope.currentFolder.id});//reload
	    }
    });
	
	/**
	 * Create a folder object
	 */
	var createFolder = function(folder){
		folder.type="folder";
		storageService.database().post(folder).then(function(response){
			if(!response.ok)	
				throw "//FIXME";
			$rootScope.$emit("reloadListView", {});
			$location.url("/folder/"+response.id);
			$scope.$apply();
			
		}).catch(function(error){
			console.log(error);//FIXME
		});
	}
	
	/**
	 * Load the current folders contents
	 */
	var loadCurrentFolderContents = function(){
		storageService.database().query(function (doc, emit) {
			  emit(doc.parentFolderID);
		}, {key: $scope.currentFolder._id, include_docs: true}).then(function (results) {
			$scope.currentFolderContents=results.rows;
			
			//Do they have anything to display?
				if($scope.currentFolder._id==null && $scope.currentFolderContents.length==0){
					alertify.alert("It looks like you dont have any folders. You can create one using the \"New Folder\" button in the top right of the page.");
				};
				
			$scope.$apply();
		}).catch(function (err) {
			console.log(err);
		});
	}
	
	/**
	 * Filter out everything but a given type
	 */
	var typeFilter = function(object,type){
		return object.doc.type==type;
	}
	
	/**
	 * Filter out everything but type folder
	 */
	$scope.folderFilter=function(object){
		return typeFilter(object,"folder");
	};
	
	/**
	 * Filter out everything but type note
	 */
	$scope.noteFilter=function(object){
		return typeFilter(object,"note");
	}
});